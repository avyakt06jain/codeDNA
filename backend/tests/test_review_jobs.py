from pathlib import Path

from codedna_memory.constants import CANDIDATE_PR_ID
from codedna_memory.database import create_database_engine, initialize_schema, seed_synthetic_provenance, session_factory
from codedna_memory.models import ReviewJob
from codedna_memory.review_jobs import create_review_job, execute_review_job
from codedna_memory.review_schemas import CandidateFinding, ReviewModelOutput


class JobModel:
    provider = "test"
    model_name = "job-model"

    def generate(self, parsed, evidence):
        return ReviewModelOutput(
            findings=[CandidateFinding(file_path="src/orders/update.ts", new_line=18, severity="warning", category="general", title="Review direct persistence update", explanation="The direct persistence update deserves explicit review before merge.", confidence="medium")]
        )


def test_background_job_persists_progress_and_result(tmp_path: Path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'jobs.sqlite3'}")
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        job = create_review_job(session, pr_id=CANDIDATE_PR_ID, memory_enabled=False)
        assert job.status == "queued"

    execute_review_job(sessions, job_id=job.id, model_factory=JobModel, memory_client_factory=None)

    with sessions() as session:
        stored = session.get(ReviewJob, job.id)
        assert stored is not None
        assert stored.status == "complete"
        assert stored.stage == "complete"
        assert stored.review_run_id is not None
        assert stored.error_code is None


def test_background_job_records_sanitized_failure(tmp_path: Path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'failed-jobs.sqlite3'}")
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        job = create_review_job(session, pr_id=CANDIDATE_PR_ID, memory_enabled=False)

    def broken_model():
        raise RuntimeError("credential should not be persisted")

    execute_review_job(sessions, job_id=job.id, model_factory=broken_model, memory_client_factory=None)

    with sessions() as session:
        stored = session.get(ReviewJob, job.id)
        assert stored is not None
        assert stored.status == "failed"
        assert stored.error_code == "review_service_unavailable"
