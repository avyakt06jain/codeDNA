from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import (
    create_database_engine,
    initialize_schema,
    seed_synthetic_provenance,
    session_factory,
)
from .evaluation import evaluate_comparison
from .hindsight_runtime import get_runtime, shared_memory_client
from .models import Decision, MemoryDocument, PullRequest, Repository, ReviewJob, ReviewRun
from .policy_service import prepare_evolved_demo, record_feedback, supersede_decision
from .review_model import GeminiReviewModel, ReviewModel
from .review_jobs import create_review_job, execute_review_job, reconcile_interrupted_jobs
from .review_schemas import FeedbackRequest, ReviewCreated, ReviewRequest, SupersedeRequest
from .review_service import ReviewService, serialize_review


def _load_environment() -> None:
    for candidate in (Path.cwd() / ".env", Path.cwd().parent / ".env"):
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            break


def _default_model() -> GeminiReviewModel:
    key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    model = os.getenv("CODEDNA_REVIEW_MODEL", "gemini-3.1-flash-lite")
    if not key:
        raise RuntimeError("CODEDNA review model credential is not configured")
    return GeminiReviewModel(api_key=key, model_name=model)


def _scope(decision: Decision) -> dict[str, Any]:
    try:
        parsed = json.loads(decision.scope_json)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _source_pr_number(session: Session, source_pr_id: str) -> int | None:
    source = session.get(PullRequest, source_pr_id)
    return None if source is None else source.number


def _memory_payload(session: Session, decision_id: str) -> dict[str, Any]:
    document = session.scalar(
        select(MemoryDocument).where(MemoryDocument.decision_id == decision_id)
    )
    if document is None:
        return {"document_id": None, "ingestion_status": None}
    return {
        "document_id": document.document_id,
        "ingestion_status": document.ingestion_status,
    }


def _decision_list_item(session: Session, decision: Decision) -> dict[str, Any]:
    return {
        "id": decision.id,
        "title": decision.title,
        "rule_text": decision.rule_text,
        "rationale": decision.rationale,
        "status": decision.status,
        "authority": decision.authority,
        "source_pr_id": decision.source_pr_id,
        "source_pr_number": _source_pr_number(session, decision.source_pr_id),
        "supersedes_decision_id": decision.supersedes_decision_id,
        "scope": _scope(decision),
    }


def _lineage(session: Session, decision_id: str) -> list[Decision]:
    current = session.get(Decision, decision_id)
    if current is None:
        raise ValueError("decision_not_found")
    chain = [current]
    seen = {current.id}
    cursor = current
    while cursor.supersedes_decision_id and cursor.supersedes_decision_id not in seen:
        parent = session.get(Decision, cursor.supersedes_decision_id)
        if parent is None:
            break
        chain.append(parent)
        seen.add(parent.id)
        cursor = parent
    chain.reverse()
    while True:
        nxt = session.scalar(
            select(Decision)
            .where(Decision.supersedes_decision_id == chain[-1].id)
            .order_by(Decision.effective_at)
        )
        if nxt is None or nxt.id in seen:
            break
        chain.append(nxt)
        seen.add(nxt.id)
    return chain


def _lineage_item(session: Session, decision: Decision) -> dict[str, Any]:
    return {
        "id": decision.id,
        "title": decision.title,
        "rule_text": decision.rule_text,
        "rationale": decision.rationale,
        "status": decision.status,
        "source_pr_id": decision.source_pr_id,
        "source_pr_number": _source_pr_number(session, decision.source_pr_id),
        "effective_at": decision.effective_at,
    }


def _serialize_comparison(session: Session, job: ReviewJob) -> dict[str, Any] | None:
    if job.status != "complete" or job.kind != "comparison":
        return None
    memory_run = session.get(ReviewRun, job.review_run_id) if job.review_run_id else None
    baseline_run = session.get(ReviewRun, job.baseline_run_id) if job.baseline_run_id else None
    if (
        memory_run is None
        or baseline_run is None
        or memory_run.pr_id != job.pr_id
        or baseline_run.pr_id != job.pr_id
    ):
        return None
    memory = serialize_review(session, memory_run)
    baseline = serialize_review(session, baseline_run)
    return {
        "evaluation": evaluate_comparison(memory, baseline),
        "memory": memory,
        "baseline": baseline,
    }


def create_app(
    *,
    database_url: str | None = None,
    model_factory: Callable[[], ReviewModel] | None = None,
    memory_client_factory: Callable[[], Any] | None = None,
) -> FastAPI:
    _load_environment()
    engine = create_database_engine(
        database_url or os.getenv("CODEDNA_DATABASE_URL", "sqlite:///./data/codedna.sqlite3")
    )
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        _app.state.interrupted_jobs = reconcile_interrupted_jobs(sessions)
        if os.getenv("CODEDNA_DEMO_SCENE") == "evolved":
            with sessions() as session:
                prepare_evolved_demo(session)
        runtime = get_runtime()
        runtime.begin(sessions)
        try:
            yield
        finally:
            runtime.shutdown()

    app = FastAPI(title="CodeDNA API", version="0.2.0", lifespan=lifespan)
    app.state.interrupted_jobs = 0
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str | int]:
        return {
            "status": "ok",
            "memory": "configured" if os.getenv("HINDSIGHT_API_LLM_API_KEY") else "unconfigured",
            "hindsight": get_runtime().status,
            "interrupted_jobs": app.state.interrupted_jobs,
        }

    @app.get("/api/repositories")
    def repositories() -> list[dict[str, Any]]:
        with sessions() as session:
            rows = session.scalars(select(Repository).order_by(Repository.slug)).all()
            return [{"id": row.id, "slug": row.slug, "display_name": row.display_name} for row in rows]

    @app.get("/api/repositories/{repository_id}/prs")
    def pull_requests(repository_id: str) -> list[dict[str, Any]]:
        with sessions() as session:
            rows = session.scalars(
                select(PullRequest)
                .where(PullRequest.repository_id == repository_id)
                .order_by(PullRequest.number)
            ).all()
            return [{"id": row.id, "number": row.number, "title": row.title, "created_at": row.created_at} for row in rows]

    @app.get("/api/prs/{pr_id}")
    def pull_request(pr_id: str) -> dict[str, Any]:
        with sessions() as session:
            row = session.get(PullRequest, pr_id)
            if row is None:
                raise HTTPException(404, "Pull request not found")
            return {"id": row.id, "repository_id": row.repository_id, "number": row.number, "title": row.title, "description": row.description, "diff_text": row.diff_text, "created_at": row.created_at}

    @app.get("/api/repositories/{repository_id}/summary")
    def repository_summary(repository_id: str) -> dict[str, Any]:
        with sessions() as session:
            repository = session.get(Repository, repository_id)
            if repository is None:
                raise HTTPException(404, "Repository not found")
            decisions = session.scalars(
                select(Decision).where(Decision.repository_id == repository_id)
            ).all()
            review_run_count = session.scalar(
                select(func.count())
                .select_from(ReviewRun)
                .join(PullRequest, ReviewRun.pr_id == PullRequest.id)
                .where(PullRequest.repository_id == repository_id)
            )
            return {
                "repository_id": repository.id,
                "slug": repository.slug,
                "display_name": repository.display_name,
                "pr_count": session.scalar(
                    select(func.count())
                    .select_from(PullRequest)
                    .where(PullRequest.repository_id == repository_id)
                )
                or 0,
                "decision_count": len(decisions),
                "active_decisions": sum(1 for item in decisions if item.status == "active"),
                "superseded_decisions": sum(
                    1 for item in decisions if item.status == "superseded"
                ),
                "pending_decisions": sum(1 for item in decisions if item.status == "proposed"),
                "review_run_count": int(review_run_count or 0),
                "hindsight": get_runtime().status,
            }

    @app.get("/api/repositories/{repository_id}/decisions")
    def decisions(repository_id: str) -> list[dict[str, Any]]:
        with sessions() as session:
            rows = session.scalars(
                select(Decision)
                .where(Decision.repository_id == repository_id)
                .order_by(Decision.effective_at, Decision.id)
            ).all()
            return [_decision_list_item(session, row) for row in rows]

    @app.get("/api/decisions/{decision_id}")
    def decision_detail(decision_id: str) -> dict[str, Any]:
        with sessions() as session:
            decision = session.get(Decision, decision_id)
            if decision is None:
                raise HTTPException(404, "Decision not found")
            successor = session.scalar(
                select(Decision)
                .where(Decision.supersedes_decision_id == decision.id)
                .order_by(Decision.effective_at)
            )
            payload = _decision_list_item(session, decision)
            payload["superseded_by_decision_id"] = None if successor is None else successor.id
            payload["memory"] = _memory_payload(session, decision.id)
            return payload

    @app.get("/api/decisions/{decision_id}/lineage")
    def decision_lineage(decision_id: str) -> dict[str, Any]:
        try:
            with sessions() as session:
                items = _lineage(session, decision_id)
                return {
                    "decision_id": decision_id,
                    "items": [_lineage_item(session, item) for item in items],
                }
        except ValueError as exc:
            raise HTTPException(404, "Decision not found") from exc

    @app.post("/api/findings/{finding_id}/feedback", status_code=201)
    def feedback(finding_id: str, request: FeedbackRequest) -> dict[str, Any]:
        try:
            with sessions() as session:
                event = record_feedback(
                    session,
                    finding_id=finding_id,
                    action=request.action,
                    actor_label=request.actor_label,
                    reason=request.reason,
                    confirm_as_policy=request.confirm_as_policy,
                )
                return {"id": event.id, "finding_id": event.finding_id, "action": event.action, "binding": event.binding, "created_at": event.created_at}
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/api/decisions/{decision_id}/supersede", status_code=201)
    def supersede(decision_id: str, request: SupersedeRequest) -> dict[str, Any]:
        try:
            factory = memory_client_factory or shared_memory_client
            with factory() as client, sessions() as session:
                replacement = supersede_decision(
                    session,
                    decision_id=decision_id,
                    source_pr_id=request.source_pr_id,
                    title=request.title,
                    rule_text=request.rule_text,
                    rationale=request.rationale,
                    scope=request.scope,
                    actor_label=request.actor_label,
                    memory_client=client,
                )
                document = session.query(MemoryDocument).filter_by(decision_id=replacement.id).one()
                return {"id": replacement.id, "status": replacement.status, "authority": replacement.authority, "source_pr_id": replacement.source_pr_id, "memory": {"document_id": document.document_id, "ingestion_status": document.ingestion_status}}
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/api/prs/{pr_id}/reviews", response_model=ReviewCreated)
    def create_review(pr_id: str, request: ReviewRequest) -> ReviewCreated:
        model = (model_factory or _default_model)()
        try:
            with sessions() as session:
                if request.memory_enabled:
                    factory = memory_client_factory or shared_memory_client
                    with factory() as client:
                        run = ReviewService(session, model).run(pr_id=pr_id, memory_client=client)
                else:
                    run = ReviewService(session, model).run(pr_id=pr_id, memory_client=None)
                return ReviewCreated(run_id=run.id, status=run.status, mode=run.mode)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        finally:
            close = getattr(model, "close", None)
            if callable(close):
                close()

    @app.post("/api/prs/{pr_id}/review-jobs", status_code=202)
    def queue_review(
        pr_id: str, request: ReviewRequest, background_tasks: BackgroundTasks
    ) -> dict[str, Any]:
        try:
            with sessions() as session:
                job = create_review_job(
                    session, pr_id=pr_id, memory_enabled=request.memory_enabled
                )
            background_tasks.add_task(
                execute_review_job,
                sessions,
                job_id=job.id,
                model_factory=model_factory or _default_model,
                memory_client_factory=(memory_client_factory or shared_memory_client)
                if request.memory_enabled
                else None,
            )
            return {"job_id": job.id, "status": job.status, "stage": job.stage}
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/api/review-jobs/{job_id}")
    def review_job(job_id: str) -> dict[str, Any]:
        with sessions() as session:
            job = session.get(ReviewJob, job_id)
            if job is None:
                raise HTTPException(404, "Review job not found")
            payload: dict[str, Any] = {
                "job_id": job.id,
                "status": job.status,
                "stage": job.stage,
                "kind": job.kind,
                "error_code": job.error_code,
                "review_run_id": job.review_run_id,
            }
            if job.status == "complete" and job.kind == "comparison":
                comparison = _serialize_comparison(session, job)
                if comparison is not None:
                    payload["comparison"] = comparison
            elif job.status == "complete" and job.review_run_id:
                run = session.get(ReviewRun, job.review_run_id)
                if run is not None:
                    payload["review"] = serialize_review(session, run)
            return payload

    @app.post("/api/prs/{pr_id}/comparison", status_code=202)
    def queue_comparison(pr_id: str, background_tasks: BackgroundTasks) -> dict[str, Any]:
        try:
            with sessions() as session:
                job = create_review_job(
                    session, pr_id=pr_id, memory_enabled=True, kind="comparison"
                )
            background_tasks.add_task(
                execute_review_job,
                sessions,
                job_id=job.id,
                model_factory=model_factory or _default_model,
                memory_client_factory=memory_client_factory or shared_memory_client,
            )
            return {"job_id": job.id, "status": job.status, "stage": job.stage}
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.get("/api/prs/{pr_id}/reviews/latest")
    def latest_review(pr_id: str, mode: str = "memory") -> dict[str, Any]:
        if mode not in {"memory", "baseline"}:
            raise HTTPException(422, "Review mode must be memory or baseline")
        with sessions() as session:
            if session.get(PullRequest, pr_id) is None:
                raise HTTPException(404, "Pull request not found")
            run = session.scalar(
                select(ReviewRun)
                .where(
                    ReviewRun.pr_id == pr_id,
                    ReviewRun.mode == mode,
                    ReviewRun.status == "complete",
                )
                .order_by(ReviewRun.created_at.desc(), ReviewRun.id.desc())
            )
            return {
                "pr_id": pr_id,
                "mode": mode,
                "review": None if run is None else serialize_review(session, run),
            }

    @app.get("/api/prs/{pr_id}/comparisons/latest")
    def latest_comparison(pr_id: str) -> dict[str, Any]:
        with sessions() as session:
            if session.get(PullRequest, pr_id) is None:
                raise HTTPException(404, "Pull request not found")
            job = session.scalar(
                select(ReviewJob)
                .where(
                    ReviewJob.pr_id == pr_id,
                    ReviewJob.kind == "comparison",
                    ReviewJob.status == "complete",
                    ReviewJob.review_run_id.is_not(None),
                    ReviewJob.baseline_run_id.is_not(None),
                )
                .order_by(ReviewJob.updated_at.desc(), ReviewJob.id.desc())
            )
            comparison = None if job is None else _serialize_comparison(session, job)
            return {
                "pr_id": pr_id,
                "job_id": None if job is None else job.id,
                "comparison": comparison,
            }

    @app.get("/api/reviews/{run_id}")
    def review(run_id: str) -> dict[str, Any]:
        with sessions() as session:
            run = session.get(ReviewRun, run_id)
            if run is None:
                raise HTTPException(404, "Review not found")
            return serialize_review(session, run)

    @app.get("/api/reviews/{run_id}/evidence")
    def review_evidence(run_id: str) -> dict[str, Any]:
        with sessions() as session:
            run = session.get(ReviewRun, run_id)
            if run is None:
                raise HTTPException(404, "Review not found")
            payload = serialize_review(session, run)
            ids = {item for finding in payload["findings"] for item in finding["evidence_ids"]}
            decisions_by_id = [session.get(Decision, item) for item in sorted(ids)]
            return {
                "run_id": run_id,
                "decisions": [
                    {"id": item.id, "title": item.title, "rule_text": item.rule_text, "rationale": item.rationale, "status": item.status, "source_pr_id": item.source_pr_id}
                    for item in decisions_by_id
                    if item is not None
                ],
            }

    return app


app = create_app()
