from __future__ import annotations

import threading
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from codedna_memory.api import create_app
from codedna_memory.constants import (
    ACME_REPOSITORY_ID,
    ANALYTICS_BANK_ID,
    ANALYTICS_CANDIDATE_PR_DIFF,
    ANALYTICS_CANDIDATE_PR_ID,
    ANALYTICS_DECISION_ID,
    ANALYTICS_DOCUMENT_ID,
    ANALYTICS_PR_DIFF,
    ANALYTICS_PR_ID,
    ANALYTICS_REPOSITORY_ID,
    CANDIDATE_PR_DIFF,
    CANDIDATE_PR_ID,
    DECISION_ID,
    DOCUMENT_ID,
    SHIPPING_DECISION_RULE,
    SUPERSEDING_DECISION_ID,
    SUPERSEDING_DOCUMENT_ID,
)
from codedna_memory.database import (
    create_database_engine,
    initialize_schema,
    seed_synthetic_provenance,
    session_factory,
)
from codedna_memory.diff_parser import parse_unified_diff
from codedna_memory.hindsight_runtime import get_runtime
from codedna_memory.models import Decision, MemoryDocument, PullRequest
from codedna_memory.policy_service import prepare_evolved_demo
from codedna_memory.review_model import SYSTEM_INSTRUCTION
from codedna_memory.review_jobs import create_review_job, execute_review_job
from codedna_memory.review_schemas import CandidateFinding, FeedbackRequest, ReviewModelOutput, ReviewRequest


def endpoints(app):
    return {route.path: route.endpoint for route in app.routes if hasattr(route, "path")}


def _status_line() -> int:
    parsed = parse_unified_diff(CANDIDATE_PR_DIFF)
    for line in parsed.added_lines:
        if "status" in line.value and "shipped" in line.value:
            return line.new_line
    raise AssertionError("candidate diff has no direct status write")


class DemoModel:
    provider = "test"
    model_name = "demo-model"
    instances = 0
    calls: list[list[dict[str, object]]] = []

    def __init__(self) -> None:
        DemoModel.instances += 1

    def generate(self, parsed, evidence):
        DemoModel.calls.append(list(evidence))
        return ReviewModelOutput(
            findings=[
                CandidateFinding(
                    file_path="src/orders/update.ts",
                    new_line=_status_line(),
                    severity="warning",
                    category="general",
                    title="Review direct status mutation",
                    explanation="The added write changes persisted order state directly and merits review.",
                    confidence="medium",
                )
            ]
        )


class RecallClient:
    def recall(self, **kwargs):
        return SimpleNamespace(
            results=[
                SimpleNamespace(
                    id="fact-1",
                    document_id=DOCUMENT_ID,
                    chunk_id="chunk-1",
                    metadata={
                        "repository_id": "repo-acme-commerce",
                        "repository_slug": "acme-commerce",
                        "decision_id": DECISION_ID,
                        "source_pr_id": "pr-acme-42",
                        "authority": "reviewer_confirmed",
                        "fixture_type": "synthetic",
                    },
                )
            ],
            chunks={"chunk-1": "historical decision"},
        )


@contextmanager
def fake_memory_client():
    yield RecallClient()


def test_repository_summary_and_decision_lineage(tmp_path):
    url = f"sqlite:///{tmp_path / 'summary.sqlite3'}"
    app = create_app(database_url=url, model_factory=DemoModel, memory_client_factory=fake_memory_client)
    route = endpoints(app)
    body = route["/api/repositories/{repository_id}/summary"](ACME_REPOSITORY_ID)
    assert body["repository_id"] == ACME_REPOSITORY_ID
    assert body["slug"] == "acme-commerce"
    assert body["pr_count"] == 4
    assert body["decision_count"] == 1
    assert body["active_decisions"] == 1
    assert body["superseded_decisions"] == 0
    assert body["pending_decisions"] == 0
    assert body["review_run_count"] == 0
    assert body["hindsight"] == "unavailable"
    with pytest.raises(HTTPException) as missing:
        route["/api/repositories/{repository_id}/summary"]("missing")
    assert missing.value.status_code == 404

    decisions = route["/api/repositories/{repository_id}/decisions"](ACME_REPOSITORY_ID)
    current = next(item for item in decisions if item["id"] == DECISION_ID)
    assert current["source_pr_number"] == 42
    assert current["supersedes_decision_id"] is None
    assert current["scope"]["paths"] == ["src/orders/**"]

    detail = route["/api/decisions/{decision_id}"](DECISION_ID)
    assert detail["superseded_by_decision_id"] is None
    assert detail["memory"]["document_id"] == DOCUMENT_ID
    assert detail["memory"]["ingestion_status"] == "pending"
    assert detail["authority"] == "reviewer_confirmed"

    analytics = route["/api/repositories/{repository_id}/summary"](ANALYTICS_REPOSITORY_ID)
    assert analytics["pr_count"] == 2
    assert analytics["active_decisions"] == 1
    assert analytics["hindsight"] == "unavailable"

    engine = create_database_engine(url)
    with session_factory(engine)() as session:
        prepare_evolved_demo(session)

    items = route["/api/decisions/{decision_id}/lineage"](SUPERSEDING_DECISION_ID)["items"]
    assert [item["id"] for item in items] == [DECISION_ID, SUPERSEDING_DECISION_ID]
    assert [item["source_pr_number"] for item in items] == [42, 103]
    assert items[0]["status"] == "superseded"
    assert items[1]["status"] == "active"
    assert items[1]["rule_text"] == SHIPPING_DECISION_RULE
    assert "effective_at" in items[0]

    evolved = route["/api/decisions/{decision_id}"](SUPERSEDING_DECISION_ID)
    assert evolved["supersedes_decision_id"] == DECISION_ID
    assert evolved["superseded_by_decision_id"] is None
    assert evolved["memory"]["document_id"] == SUPERSEDING_DOCUMENT_ID
    previous = route["/api/decisions/{decision_id}"](DECISION_ID)
    assert previous["status"] == "superseded"
    assert previous["superseded_by_decision_id"] == SUPERSEDING_DECISION_ID
    from_original = route["/api/decisions/{decision_id}/lineage"](DECISION_ID)
    assert [item["id"] for item in from_original["items"]] == [
        DECISION_ID,
        SUPERSEDING_DECISION_ID,
    ]
    refreshed = route["/api/repositories/{repository_id}/summary"](ACME_REPOSITORY_ID)
    assert refreshed["active_decisions"] == 1
    assert refreshed["superseded_decisions"] == 1
    assert refreshed["decision_count"] == 2


def test_feedback_confirm_as_policy_fails_closed(tmp_path):
    url = f"sqlite:///{tmp_path / 'feedback.sqlite3'}"
    app = create_app(database_url=url, model_factory=DemoModel)
    route = endpoints(app)
    created = route["/api/prs/{pr_id}/reviews"](
        CANDIDATE_PR_ID, ReviewRequest(memory_enabled=False)
    )
    review = route["/api/reviews/{run_id}"](created.run_id)
    assert review["retrieval"]["timings_ms"]["recall"] == 0
    restored = route["/api/prs/{pr_id}/reviews/latest"](
        CANDIDATE_PR_ID, mode="baseline"
    )
    assert restored["review"]["run_id"] == created.run_id
    assert restored["review"]["mode"] == "baseline"
    assert (
        route["/api/prs/{pr_id}/reviews/latest"](
            CANDIDATE_PR_ID, mode="memory"
        )["review"]
        is None
    )
    finding_id = review["findings"][0]["id"]
    with pytest.raises(HTTPException) as rejected:
        route["/api/findings/{finding_id}/feedback"](
            finding_id,
            FeedbackRequest(
                action="rejected",
                actor_label="demo-reviewer",
                reason="This note is not a new design.",
                confirm_as_policy=True,
            ),
        )
    assert rejected.value.status_code == 422
    assert rejected.value.detail == "feedback_cannot_directly_create_policy"
    with session_factory(create_database_engine(url))() as session:
        assert session.get(Decision, DECISION_ID).status == "active"
        assert session.get(Decision, SUPERSEDING_DECISION_ID) is None


def test_warm_runtime_is_not_started_under_pytest(tmp_path, monkeypatch):
    calls = []

    def refuse_boot():
        calls.append("boot")
        raise AssertionError("Hindsight booted under pytest")

    monkeypatch.setenv("CODEDNA_HINDSIGHT_AUTOSTART", "0")
    monkeypatch.setattr(
        "codedna_memory.hindsight_runtime.boot_hindsight_server",
        refuse_boot,
    )
    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'warm.sqlite3'}",
        model_factory=DemoModel,
    )
    assert calls == []
    body = endpoints(app)["/api/health"]()
    assert body["status"] == "ok"
    assert body["memory"] in {"configured", "unconfigured"}
    assert body["hindsight"] == "unavailable"
    assert body["interrupted_jobs"] == 0
    assert calls == []
    assert get_runtime().status == "unavailable"


def test_comparison_job_completes_with_injected_clients(tmp_path, monkeypatch):
    DemoModel.instances = 0
    DemoModel.calls = []
    calls = []
    monkeypatch.setattr(
        "codedna_memory.hindsight_runtime.boot_hindsight_server",
        lambda: calls.append("boot"),
    )
    url = f"sqlite:///{tmp_path / 'comparison.sqlite3'}"
    app = create_app(
        database_url=url,
        model_factory=DemoModel,
        memory_client_factory=fake_memory_client,
    )
    with session_factory(create_database_engine(url))() as session:
        document = session.get(MemoryDocument, DOCUMENT_ID)
        assert document is not None
        document.ingestion_status = "ready"
        session.commit()

    sessions = session_factory(create_database_engine(url))
    with sessions() as session:
        queued = create_review_job(
            session, pr_id=CANDIDATE_PR_ID, memory_enabled=True, kind="comparison"
        )
    assert queued.status == "queued"
    assert queued.stage == "queued"
    execute_review_job(
        sessions,
        job_id=queued.id,
        model_factory=DemoModel,
        memory_client_factory=fake_memory_client,
    )
    payload = endpoints(app)["/api/review-jobs/{job_id}"](queued.id)

    assert calls == []
    assert DemoModel.instances == 1
    assert payload["kind"] == "comparison"
    assert payload["status"] == "complete"
    assert "review" not in payload
    comparison = payload["comparison"]
    assert comparison["memory"]["mode"] == "memory"
    assert comparison["baseline"]["mode"] == "baseline"
    assert comparison["memory"]["provider"] == comparison["baseline"]["provider"]
    assert comparison["memory"]["model"] == comparison["baseline"]["model"]
    assert comparison["baseline"]["retrieval"]["timings_ms"]["recall"] == 0
    assert comparison["baseline"]["retrieval"]["timings_ms"]["query"] == 0
    memory_timings = comparison["memory"]["retrieval"]["timings_ms"]
    assert set(memory_timings) == {"query", "recall", "validation", "generation"}
    assert all(isinstance(value, int) and value >= 0 for value in memory_timings.values())
    assert comparison["memory"]["retrieval"]["validated_evidence"]
    assert DemoModel.calls[0]
    assert DemoModel.calls[1] == []
    assert "evaluation" in comparison
    assert comparison["evaluation"]["run_ids"]["memory"]
    assert comparison["evaluation"]["run_ids"]["baseline"]


def test_supersession_column_and_prepare_idempotency(tmp_path):
    url = f"sqlite:///{tmp_path / 'supersede.sqlite3'}"
    engine = create_database_engine(url)
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        assert session.get(Decision, DECISION_ID).status == "active"
        assert session.get(Decision, SUPERSEDING_DECISION_ID) is None
        first = prepare_evolved_demo(session)
        assert first.id == SUPERSEDING_DECISION_ID
        assert first.supersedes_decision_id == DECISION_ID
        assert session.get(Decision, DECISION_ID).status == "superseded"
        second = prepare_evolved_demo(session)
        assert second.id == first.id
        assert session.get(MemoryDocument, SUPERSEDING_DOCUMENT_ID).ingestion_status == "pending"

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE decisions DROP COLUMN supersedes_decision_id"))
    initialize_schema(engine)
    with engine.connect() as connection:
        restored = connection.execute(
            text(
                "SELECT supersedes_decision_id FROM decisions WHERE id = :decision_id"
            ),
            {"decision_id": SUPERSEDING_DECISION_ID},
        ).scalar_one()
    assert restored == DECISION_ID

    calls = []

    class RetainClient:
        def retain(self, **kwargs):
            calls.append(kwargs["document_id"])
            return SimpleNamespace()

    with sessions() as session:
        document = session.get(MemoryDocument, SUPERSEDING_DOCUMENT_ID)
        document.ingestion_status = "failed"
        session.commit()
        prepare_evolved_demo(session, memory_client=RetainClient())
        assert calls == [SUPERSEDING_DOCUMENT_ID]
        assert session.get(MemoryDocument, SUPERSEDING_DOCUMENT_ID).ingestion_status == "ready"
        prepare_evolved_demo(session, memory_client=RetainClient())
        assert calls == [SUPERSEDING_DOCUMENT_ID]


def test_candidate_diff_is_refreshed_without_leaking_the_fix(tmp_path):
    parsed = parse_unified_diff(CANDIDATE_PR_DIFF)
    assert parsed.files == ("src/orders/update.ts",)
    assert any("prisma.order.update" in line.value for line in parsed.added_lines)
    assert any("status" in line.value and "shipped" in line.value for line in parsed.added_lines)
    lowered = CANDIDATE_PR_DIFF.lower()
    assert "orderworkflow" not in lowered
    assert "transitionorder" not in lowered
    assert "audited transition" not in lowered
    assert _status_line() == 16

    url = f"sqlite:///{tmp_path / 'diff.sqlite3'}"
    engine = create_database_engine(url)
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        row = session.get(PullRequest, CANDIDATE_PR_ID)
        row.diff_text = "--- a/src/orders/update.ts\n+++ b/src/orders/update.ts\n@@ -1,0 +1,1 @@\n+stale\n"
        session.commit()
    with sessions() as session:
        seed_synthetic_provenance(session)
        row = session.get(PullRequest, CANDIDATE_PR_ID)
        assert row.diff_text == CANDIDATE_PR_DIFF
        assert session.get(Decision, DECISION_ID).status == "active"


def test_analytics_fixture_is_a_separate_design(tmp_path):
    parsed = parse_unified_diff(ANALYTICS_PR_DIFF)
    assert parsed.files == ("src/events/capture.ts",)
    engine = create_database_engine(f"sqlite:///{tmp_path / 'analytics.sqlite3'}")
    initialize_schema(engine)
    with session_factory(engine)() as session:
        seed_synthetic_provenance(session)
        decision = session.get(Decision, ANALYTICS_DECISION_ID)
        pull_request = session.get(PullRequest, ANALYTICS_PR_ID)
        candidate = session.get(PullRequest, ANALYTICS_CANDIDATE_PR_ID)
        document = session.get(MemoryDocument, ANALYTICS_DOCUMENT_ID)
        assert decision.status == "active"
        assert decision.repository_id == ANALYTICS_REPOSITORY_ID
        assert pull_request.repository_id == ANALYTICS_REPOSITORY_ID
        assert pull_request.number == 11
        assert candidate.repository_id == ANALYTICS_REPOSITORY_ID
        assert candidate.number == 29
        assert candidate.diff_text == ANALYTICS_CANDIDATE_PR_DIFF
        assert document.bank_id == ANALYTICS_BANK_ID
        assert document.ingestion_status == "pending"
        blob = " ".join(
            [
                decision.title,
                decision.rule_text,
                decision.rationale,
                pull_request.diff_text,
            ]
        ).lower()
        assert "order" not in blob
        assert "dec-0042" not in blob
        candidate_blob = f"{candidate.title} {candidate.description} {candidate.diff_text}".lower()
        assert "utc" not in candidate_blob
        assert "toisostring" not in candidate_blob
        assert ANALYTICS_DECISION_ID.lower() not in candidate_blob
        assert ANALYTICS_PR_ID.lower() not in candidate_blob
        assert session.get(Decision, DECISION_ID).status == "active"


def test_system_instruction_keeps_superseded_decisions_as_history():
    assert "compiles" in SYSTEM_INSTRUCTION
    assert "current design" in SYSTEM_INSTRUCTION
    assert "Superseded decisions are history and must not be cited." in SYSTEM_INSTRUCTION


def test_shared_client_is_opened_on_the_caller_thread(monkeypatch):
    created = []

    class CallerClient:
        def __init__(self, *, base_url: str, timeout: float) -> None:
            self.base_url = base_url
            self.timeout = timeout
            self.thread = threading.get_ident()
            self.closed = False
            created.append(self)

        def close(self) -> None:
            self.closed = True

    monkeypatch.setattr("hindsight_client.Hindsight", CallerClient)
    runtime = get_runtime()
    previous = (runtime.status, runtime.base_url, runtime._client)
    runtime.status = "ready"
    runtime.base_url = "http://127.0.0.1:63071"
    runtime._client = object()
    seen = []

    def open_client() -> None:
        from codedna_memory.hindsight_runtime import shared_memory_client

        with shared_memory_client() as client:
            seen.append(client)

    try:
        worker = threading.Thread(target=open_client)
        worker.start()
        worker.join()
        assert len(created) == 1
        assert seen == created
        assert created[0] is not runtime._client
        assert created[0].base_url == "http://127.0.0.1:63071"
        assert created[0].timeout == 60
        assert created[0].thread == worker.ident
        assert created[0].closed is True
    finally:
        runtime.status, runtime.base_url, runtime._client = previous
