from __future__ import annotations

import uuid
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .models import PullRequest, ReviewJob
from .review_model import ReviewModel
from .review_service import ReviewService


@dataclass(frozen=True)
class ReviewJobClaim:
    job: ReviewJob
    created: bool


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_review_job(
    session: Session,
    *,
    pr_id: str,
    memory_enabled: bool,
    kind: str = "review",
) -> ReviewJob:
    if kind not in {"review", "comparison"}:
        raise ValueError("invalid_review_job_kind")
    if session.get(PullRequest, pr_id) is None:
        raise ValueError("pull_request_not_found")
    job = ReviewJob(
        id=f"job-{uuid.uuid4().hex[:16]}",
        pr_id=pr_id,
        memory_enabled=memory_enabled,
        kind=kind,
        status="queued",
        stage="queued",
    )
    session.add(job)
    session.commit()
    return job


def find_active_review_job(
    session: Session,
    *,
    pr_id: str,
    kind: str,
) -> ReviewJob | None:
    """Return the newest observable job for one stored PR and job kind."""
    if kind not in {"review", "comparison"}:
        raise ValueError("invalid_review_job_kind")
    if session.get(PullRequest, pr_id) is None:
        raise ValueError("pull_request_not_found")
    return session.scalar(
        select(ReviewJob)
        .where(
            ReviewJob.pr_id == pr_id,
            ReviewJob.kind == kind,
            ReviewJob.status.in_(("queued", "running")),
        )
        .order_by(ReviewJob.updated_at.desc(), ReviewJob.created_at.desc(), ReviewJob.id.desc())
    )


def claim_review_job(
    session: Session,
    *,
    pr_id: str,
    memory_enabled: bool,
    kind: str = "review",
) -> ReviewJobClaim:
    """Atomically create work or reuse the active same-PR/same-kind job."""
    if kind not in {"review", "comparison"}:
        raise ValueError("invalid_review_job_kind")

    if session.bind is not None and session.bind.dialect.name == "sqlite":
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        pull_request = session.get(PullRequest, pr_id)
    else:
        pull_request = session.scalar(
            select(PullRequest)
            .where(PullRequest.id == pr_id)
            .with_for_update()
        )
    if pull_request is None:
        session.rollback()
        raise ValueError("pull_request_not_found")

    active = session.scalar(
        select(ReviewJob)
        .where(
            ReviewJob.pr_id == pr_id,
            ReviewJob.kind == kind,
            ReviewJob.status.in_(("queued", "running")),
        )
        .order_by(ReviewJob.updated_at.desc(), ReviewJob.created_at.desc(), ReviewJob.id.desc())
    )
    if active is not None:
        session.commit()
        return ReviewJobClaim(job=active, created=False)

    job = ReviewJob(
        id=f"job-{uuid.uuid4().hex[:16]}",
        pr_id=pr_id,
        memory_enabled=memory_enabled,
        kind=kind,
        status="queued",
        stage="queued",
    )
    session.add(job)
    session.commit()
    return ReviewJobClaim(job=job, created=True)


def reconcile_interrupted_jobs(sessions: sessionmaker[Session]) -> int:
    """Fail nonterminal jobs left behind by a previous API process.

    Retrying a partially executed review could duplicate provider calls or persisted
    review runs. A new request is therefore required after a restart.
    """
    with sessions() as session:
        jobs = session.scalars(
            select(ReviewJob).where(ReviewJob.status.in_(("queued", "running")))
        ).all()
        if not jobs:
            return 0
        reconciled_at = utc_now()
        for job in jobs:
            job.status = "failed"
            job.stage = "failed"
            job.error_code = "job_interrupted_by_restart"
            job.updated_at = reconciled_at
        session.commit()
        return len(jobs)


def execute_review_job(
    sessions: sessionmaker[Session],
    *,
    job_id: str,
    model_factory: Callable[[], ReviewModel],
    memory_client_factory: Callable[[], Any] | None,
) -> None:
    model: ReviewModel | None = None
    try:
        with sessions() as session:
            job = session.get(ReviewJob, job_id)
            if job is None or job.status != "queued":
                return
            job.status = "running"
            comparison = job.kind == "comparison"
            job.stage = (
                "starting_hindsight"
                if comparison or job.memory_enabled
                else "reviewing_diff"
            )
            job.updated_at = utc_now()
            session.commit()

            model = model_factory()
            if comparison:
                if memory_client_factory is None:
                    raise ValueError("hindsight_unavailable")
                with memory_client_factory() as client:
                    job.stage = "recalling_and_reviewing"
                    job.updated_at = utc_now()
                    session.commit()
                    memory_run = ReviewService(session, model).run(
                        pr_id=job.pr_id, memory_client=client
                    )
                job.stage = "reviewing_baseline"
                job.updated_at = utc_now()
                session.commit()
                baseline_run = ReviewService(session, model).run(
                    pr_id=job.pr_id, memory_client=None
                )
                job.review_run_id = memory_run.id
                job.baseline_run_id = baseline_run.id
            else:
                memory_context = (
                    memory_client_factory()
                    if job.memory_enabled and memory_client_factory is not None
                    else nullcontext(None)
                )
                with memory_context as client:
                    job.stage = (
                        "recalling_and_reviewing" if job.memory_enabled else "reviewing_diff"
                    )
                    job.updated_at = utc_now()
                    session.commit()
                    run = ReviewService(session, model).run(
                        pr_id=job.pr_id, memory_client=client
                    )
                job.review_run_id = run.id
            job.status = "complete"
            job.stage = "complete"
            job.updated_at = utc_now()
            session.commit()
    except Exception as exc:
        with sessions() as session:
            job = session.get(ReviewJob, job_id)
            if job is not None:
                job.status = "failed"
                job.stage = "failed"
                job.error_code = (
                    str(exc) if isinstance(exc, ValueError) else "review_service_unavailable"
                )[:120]
                job.updated_at = utc_now()
                session.commit()
    finally:
        close = getattr(model, "close", None)
        if callable(close):
            close()
