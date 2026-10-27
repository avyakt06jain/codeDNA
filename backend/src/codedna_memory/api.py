from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .database import (
    create_database_engine,
    initialize_schema,
    seed_synthetic_provenance,
    session_factory,
)
from .models import Decision, PullRequest, Repository, ReviewRun
from .review_model import GeminiReviewModel, ReviewModel
from .review_schemas import ReviewCreated, ReviewRequest
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


@contextmanager
def _default_memory_client() -> Iterator[Any]:
    from hindsight import HindsightServer
    from hindsight_client import Hindsight

    key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    provider = os.getenv("HINDSIGHT_API_LLM_PROVIDER", "gemini")
    model = os.getenv("HINDSIGHT_API_LLM_MODEL", "gemini-3.1-flash-lite")
    if not key:
        raise RuntimeError("Hindsight credential is not configured")
    server = HindsightServer(
        db_url=os.getenv("HINDSIGHT_API_DATABASE_URL", "pg0"),
        llm_provider=provider,
        llm_api_key=key,
        llm_model=model,
        log_level="warning",
    ).start(timeout=180)
    client = Hindsight(base_url=server.url, timeout=60)
    try:
        yield client
    finally:
        client.close()
        server.stop(timeout=60)


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

    app = FastAPI(title="CodeDNA API", version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "memory": "configured" if os.getenv("HINDSIGHT_API_LLM_API_KEY") else "unconfigured"}

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

    @app.get("/api/repositories/{repository_id}/decisions")
    def decisions(repository_id: str) -> list[dict[str, Any]]:
        with sessions() as session:
            rows = session.scalars(select(Decision).where(Decision.repository_id == repository_id)).all()
            return [{"id": row.id, "title": row.title, "rule_text": row.rule_text, "rationale": row.rationale, "status": row.status, "authority": row.authority, "source_pr_id": row.source_pr_id} for row in rows]

    @app.post("/api/prs/{pr_id}/reviews", response_model=ReviewCreated)
    def create_review(pr_id: str, request: ReviewRequest) -> ReviewCreated:
        model = (model_factory or _default_model)()
        try:
            with sessions() as session:
                if request.memory_enabled:
                    factory = memory_client_factory or _default_memory_client
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
