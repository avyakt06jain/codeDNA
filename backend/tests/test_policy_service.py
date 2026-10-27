from __future__ import annotations

from codedna_memory.constants import CANDIDATE_PR_ID, DECISION_ID, SUPERSESSION_SOURCE_PR_ID, SUPERSEDING_DECISION_ID, SUPERSEDING_DOCUMENT_ID
from codedna_memory.database import create_database_engine, initialize_schema, seed_synthetic_provenance, session_factory
from codedna_memory.models import Decision, FeedbackEvent, MemoryDocument
from codedna_memory.policy_service import record_feedback, supersede_decision
from codedna_memory.review_schemas import CandidateFinding, ReviewModelOutput
from codedna_memory.review_service import ReviewService


class GeneralFindingModel:
    provider = "test"
    model_name = "test"

    def generate(self, parsed, evidence):
        return ReviewModelOutput(findings=[CandidateFinding(file_path="src/orders/update.ts", new_line=16, severity="warning", category="general", title="Review this direct update", explanation="This direct persistence update deserves explicit review.", confidence="medium")])


def seeded_session():
    engine = create_database_engine("sqlite+pysqlite:///:memory:")
    initialize_schema(engine)
    sessions = session_factory(engine)
    session = sessions()
    seed_synthetic_provenance(session)
    return session


def test_feedback_is_nonbinding_and_cannot_promote_policy():
    session = seeded_session()
    run = ReviewService(session, GeneralFindingModel()).run(pr_id=CANDIDATE_PR_ID, memory_client=None)
    finding = run.findings[0]
    event = record_feedback(session, finding_id=finding.id, action="accepted", actor_label="reviewer", reason="Useful here", confirm_as_policy=False)
    assert event.binding is False
    assert session.get(FeedbackEvent, event.id) is not None
    try:
        record_feedback(session, finding_id=finding.id, action="accepted", actor_label="reviewer", reason=None, confirm_as_policy=True)
    except ValueError as exc:
        assert str(exc) == "feedback_cannot_directly_create_policy"
    else:
        raise AssertionError("feedback promoted policy")


def test_explicit_maintainer_supersession_changes_authoritative_state():
    session = seeded_session()
    replacement = supersede_decision(
        session,
        decision_id=DECISION_ID,
        source_pr_id=SUPERSESSION_SOURCE_PR_ID,
        title="Shipment transitions use the shipping workflow",
        rule_text="Use OrderWorkflow.shipOrder() for transitions to shipped.",
        rationale="The specialized workflow emits shipment and audit events atomically.",
        scope={"paths": ["src/orders/**"], "operations": ["transition to shipped"]},
        actor_label="demo-maintainer",
    )
    assert replacement.id == SUPERSEDING_DECISION_ID
    assert replacement.supersedes_decision_id == DECISION_ID
    assert replacement.status == "active"
    assert session.get(Decision, DECISION_ID).status == "superseded"
    document = session.get(MemoryDocument, SUPERSEDING_DOCUMENT_ID)
    assert document is not None
    assert document.ingestion_status == "pending"
