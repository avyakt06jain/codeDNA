from __future__ import annotations

import uuid
from contextlib import nullcontext
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy.orm import Session, sessionmaker

from .models import PullRequest, ReviewJob
from .review_model import ReviewModel
from .review_service import ReviewService


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_review_job(
    session: Session, *, pr_id: str, memory_enabled: bool
) -> ReviewJob:
    if session.get(PullRequest, pr_id) is None:
        raise ValueError("pull_request_not_found")
    job = ReviewJob(
        id=f"job-{uuid.uuid4().hex[:16]}",
        pr_id=pr_id,
        memory_enabled=memory_enabled,
        status="queued",
        stage="queued",
    )
    session.add(job)
    session.commit()
    return job


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
            job.stage = "starting_hindsight" if job.memory_enabled else "reviewing_diff"
            job.updated_at = utc_now()
            session.commit()

            model = model_factory()
            memory_context = (
                memory_client_factory()
                if job.memory_enabled and memory_client_factory is not None
                else nullcontext(None)
            )
            with memory_context as client:
                job.stage = "recalling_and_reviewing" if job.memory_enabled else "reviewing_diff"
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
