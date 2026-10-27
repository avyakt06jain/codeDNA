from __future__ import annotations

from pathlib import Path

from codedna_memory.api import create_app
from codedna_memory.constants import CANDIDATE_PR_ID
from codedna_memory.database import create_database_engine, initialize_schema, seed_synthetic_provenance, session_factory
from codedna_memory.diff_parser import DiffValidationError, parse_unified_diff
from codedna_memory.models import PullRequest
from codedna_memory.review_schemas import CandidateFinding, ReviewModelOutput, ReviewRequest
from codedna_memory.review_service import ReviewService, serialize_review, validate_candidate


class FakeModel:
    provider = "test"
    model_name = "deterministic-test-model"

    def generate(self, parsed, evidence):
        return ReviewModelOutput(
            findings=[
                CandidateFinding(
                    file_path="src/orders/update.ts",
                    new_line=19,
                    severity="warning",
                    category="general",
                    title="Review direct status mutation",
                    explanation="The added write changes persisted order state directly and merits review.",
                    suggested_change="Route the mutation through the appropriate domain service.",
                    confidence="medium",
                )
            ]
        )


def candidate(**overrides):
    values = {
        "file_path": "src/orders/update.ts",
        "new_line": 19,
        "severity": "warning",
        "category": "team_convention",
        "title": "Use the approved transition workflow",
        "explanation": "The direct update conflicts with confirmed repository guidance.",
        "suggested_change": "Use the approved service method.",
        "confidence": "high",
        "evidence_ids": ["DEC-0042"],
    }
    values.update(overrides)
    return CandidateFinding(**values)


def parsed_candidate_diff():
    return parse_unified_diff(
        "--- a/src/orders/update.ts\n+++ b/src/orders/update.ts\n"
        "@@ -17,0 +18,3 @@\n+await prisma.order.update({\n"
        "+  data: { status: 'shipped' },\n+});\n"
    )


def test_diff_parser_maps_only_added_new_lines():
    parsed = parsed_candidate_diff()
    assert parsed.files == ("src/orders/update.ts",)
    assert [line.new_line for line in parsed.added_lines] == [18, 19, 20]
    assert parsed.allows("src/orders/update.ts", 19)
    assert not parsed.allows("src/orders/update.ts", 17)


def test_diff_parser_rejects_path_traversal():
    text = "--- a/../../secret\n+++ b/../../secret\n@@ -0,0 +1 @@\n+x\n"
    try:
        parse_unified_diff(text)
    except DiffValidationError as exc:
        assert str(exc) == "unsafe_diff_path"
    else:
        raise AssertionError("unsafe path was accepted")


def test_finding_validation_rejects_invalid_line_and_fabricated_evidence():
    parsed = parsed_candidate_diff()
    assert validate_candidate(candidate(new_line=17), parsed=parsed, allowed_decision_ids={"DEC-0042"}) == "invalid_file_or_new_line"
    assert validate_candidate(candidate(evidence_ids=["DEC-FAKE"]), parsed=parsed, allowed_decision_ids={"DEC-0042"}) == "team_finding_unallowlisted_evidence"


def test_baseline_rejects_team_specific_finding():
    assert validate_candidate(candidate(), parsed=parsed_candidate_diff(), allowed_decision_ids=set()) == "team_finding_unallowlisted_evidence"


def test_baseline_review_persists_validated_finding(tmp_path: Path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'review.sqlite3'}")
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        run = ReviewService(session, FakeModel()).run(pr_id=CANDIDATE_PR_ID, memory_client=None)
        payload = serialize_review(session, run)
    assert payload["mode"] == "baseline"
    assert payload["status"] == "complete"
    assert len(payload["findings"]) == 1
    assert payload["findings"][0]["new_line"] == 19
    assert payload["findings"][0]["evidence_ids"] == []


def test_http_contract_lists_fixture_and_runs_baseline(tmp_path: Path):
    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'api.sqlite3'}",
        model_factory=FakeModel,
    )
    endpoint = {route.path: route.endpoint for route in app.routes if hasattr(route, "path")}
    repositories = endpoint["/api/repositories"]()
    acme = next(item for item in repositories if item["slug"] == "acme-commerce")
    prs = endpoint["/api/repositories/{repository_id}/prs"](acme["id"])
    assert any(item["id"] == CANDIDATE_PR_ID for item in prs)
    created = endpoint["/api/prs/{pr_id}/reviews"](
        CANDIDATE_PR_ID, ReviewRequest(memory_enabled=False)
    )
    result = endpoint["/api/reviews/{run_id}"](created.run_id)
    assert result["findings"][0]["file_path"] == "src/orders/update.ts"
