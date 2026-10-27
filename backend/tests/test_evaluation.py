from types import SimpleNamespace

from codedna_memory.constants import (
    ANALYTICS_BANK_ID,
    ANALYTICS_CANDIDATE_PR_DIFF,
    ANALYTICS_CANDIDATE_PR_ID,
    ANALYTICS_DECISION_ID,
    ANALYTICS_DOCUMENT_ID,
    ANALYTICS_PR_ID,
)
from codedna_memory.database import (
    create_database_engine,
    initialize_schema,
    seed_synthetic_provenance,
    session_factory,
)
from codedna_memory.diff_parser import build_memory_query, parse_unified_diff
from codedna_memory.evaluation import evaluate_comparison
from codedna_memory.models import MemoryDocument, PullRequest
from codedna_memory.review_schemas import CandidateFinding, ReviewModelOutput
from codedna_memory.review_service import ReviewService, serialize_review


def review(mode, *, findings, validated=None):
    return {
        "run_id": f"run-{mode}",
        "pr_id": "pr-120",
        "mode": mode,
        "provider": "test",
        "model": "same-model",
        "findings": findings,
        "retrieval": {"validated_evidence": validated or []},
    }


def test_memory_lab_accepts_grounded_difference():
    memory = review(
        "memory",
        findings=[{"category": "team_convention", "evidence_ids": ["DEC-0103"]}],
        validated=[{"decision_id": "DEC-0103"}],
    )
    baseline = review(
        "baseline", findings=[{"category": "general", "evidence_ids": []}]
    )
    result = evaluate_comparison(memory, baseline)
    assert result["passed"] is True
    assert result["counts"]["memory_citations"] == 1
    assert result["counts"]["baseline_citations"] == 0


def test_memory_lab_rejects_baseline_contamination():
    memory = review(
        "memory",
        findings=[{"category": "team_convention", "evidence_ids": ["DEC-0103"]}],
        validated=[{"decision_id": "DEC-0103"}],
    )
    baseline = review(
        "baseline",
        findings=[{"category": "team_convention", "evidence_ids": ["DEC-0103"]}],
    )
    result = evaluate_comparison(memory, baseline)
    assert result["passed"] is False
    assert result["checks"]["baseline_has_no_memory_citations"] is False


class AnalyticsEvaluationModel:
    provider = "test"
    model_name = "analytics-evaluation-model"

    def generate(self, parsed, evidence):
        line = next(
            item for item in parsed.added_lines if "toLocaleString" in item.value
        )
        if evidence:
            return ReviewModelOutput(
                findings=[
                    CandidateFinding(
                        file_path=line.file_path,
                        new_line=line.new_line,
                        severity="warning",
                        category="team_convention",
                        title="Timestamp persistence conflicts with team guidance",
                        explanation=(
                            "The locale-formatted value conflicts with the validated "
                            "repository decision supplied to this review."
                        ),
                        suggested_change="Persist a region-independent timestamp representation.",
                        confidence="high",
                        evidence_ids=[ANALYTICS_DECISION_ID],
                    )
                ]
            )
        return ReviewModelOutput(
            findings=[
                CandidateFinding(
                    file_path=line.file_path,
                    new_line=line.new_line,
                    severity="info",
                    category="general",
                    title="Review locale-formatted timestamp persistence",
                    explanation=(
                        "Locale-formatted values can be difficult to compare consistently "
                        "when stored as application data."
                    ),
                    confidence="medium",
                )
            ]
        )


class AnalyticsRecallClient:
    def __init__(self):
        self.calls = []

    def recall(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            results=[
                SimpleNamespace(
                    id="fact-analytics-1",
                    document_id=ANALYTICS_DOCUMENT_ID,
                    chunk_id="chunk-analytics-1",
                    metadata={
                        "repository_id": "repo-analytics-service",
                        "repository_slug": "analytics-service",
                        "decision_id": ANALYTICS_DECISION_ID,
                        "source_pr_id": ANALYTICS_PR_ID,
                        "authority": "reviewer_confirmed",
                        "fixture_type": "synthetic",
                    },
                )
            ],
            chunks={"chunk-analytics-1": "validated analytics history"},
        )


def test_second_held_out_case_is_grounded_and_uncontaminated(tmp_path):
    parsed = parse_unified_diff(ANALYTICS_CANDIDATE_PR_DIFF)
    query = build_memory_query(parsed)
    assert "timestamp persistence" in query
    candidate_blob = f"{ANALYTICS_CANDIDATE_PR_DIFF} {query}".lower()
    for leaked_answer in (
        "utc",
        "toisostring",
        ANALYTICS_DECISION_ID.lower(),
        ANALYTICS_DOCUMENT_ID.lower(),
        ANALYTICS_PR_ID.lower(),
    ):
        assert leaked_answer not in candidate_blob

    engine = create_database_engine(f"sqlite:///{tmp_path / 'analytics-evaluation.sqlite3'}")
    initialize_schema(engine)
    client = AnalyticsRecallClient()
    with session_factory(engine)() as session:
        seed_synthetic_provenance(session)
        candidate = session.get(PullRequest, ANALYTICS_CANDIDATE_PR_ID)
        document = session.get(MemoryDocument, ANALYTICS_DOCUMENT_ID)
        assert candidate is not None
        assert candidate.repository_id == "repo-analytics-service"
        assert document is not None
        document.ingestion_status = "ready"
        session.commit()

        model = AnalyticsEvaluationModel()
        memory_run = ReviewService(session, model).run(
            pr_id=ANALYTICS_CANDIDATE_PR_ID, memory_client=client
        )
        baseline_run = ReviewService(session, model).run(
            pr_id=ANALYTICS_CANDIDATE_PR_ID, memory_client=None
        )
        memory = serialize_review(session, memory_run)
        baseline = serialize_review(session, baseline_run)

    assert len(client.calls) == 1
    assert client.calls[0]["bank_id"] == ANALYTICS_BANK_ID
    assert client.calls[0]["query"] == query
    assert memory["retrieval"]["validated_evidence"] == [
        {
            "fact_id": "fact-analytics-1",
            "document_id": ANALYTICS_DOCUMENT_ID,
            "decision_id": ANALYTICS_DECISION_ID,
            "source_pr_id": ANALYTICS_PR_ID,
            "source_pr_number": 11,
            "repository_id": "repo-analytics-service",
            "repository_slug": "analytics-service",
            "bank_id": ANALYTICS_BANK_ID,
            "chunk_id": "chunk-analytics-1",
        }
    ]
    assert baseline["retrieval"]["validated_evidence"] == []
    result = evaluate_comparison(memory, baseline)
    assert result["passed"] is True
    assert all(result["checks"].values())
