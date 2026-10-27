from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from hindsight import HindsightServer
from hindsight_client import Hindsight
from sqlalchemy import select

from .constants import DECISION_ID, SUPERSESSION_CANDIDATE_PR_ID, SUPERSESSION_SOURCE_PR_ID, SUPERSEDING_DECISION_ID
from .database import create_database_engine, initialize_schema, seed_synthetic_provenance, session_factory
from .models import Decision, Finding, MemoryDocument
from .policy_service import record_feedback, supersede_decision
from .review_model import GeminiReviewModel
from .review_service import ReviewService, serialize_review


def main() -> None:
    for candidate in (Path.cwd() / ".env", Path.cwd().parent / ".env"):
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            break
    key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    model_name = os.getenv("CODEDNA_REVIEW_MODEL", "gemini-3.1-flash-lite")
    if not key:
        raise SystemExit("HINDSIGHT_API_LLM_API_KEY is required")
    engine = create_database_engine(os.getenv("CODEDNA_DATABASE_URL", "sqlite:///./data/codedna.sqlite3"))
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        finding = session.scalar(select(Finding).order_by(Finding.id))
        feedback = None
        if finding is not None:
            feedback = record_feedback(session, finding_id=finding.id, action="accepted", actor_label="demo-reviewer", reason="Useful in this review only.", confirm_as_policy=False)

    server = HindsightServer(db_url=os.getenv("HINDSIGHT_API_DATABASE_URL", "pg0"), llm_provider=os.getenv("HINDSIGHT_API_LLM_PROVIDER", "gemini"), llm_api_key=key, llm_model=os.getenv("HINDSIGHT_API_LLM_MODEL", model_name), log_level="warning").start(timeout=180)
    client = Hindsight(base_url=server.url, timeout=60)
    model = GeminiReviewModel(api_key=key, model_name=model_name)
    try:
        with sessions() as session:
            if session.get(Decision, SUPERSEDING_DECISION_ID) is None:
                supersede_decision(
                    session,
                    decision_id=DECISION_ID,
                    source_pr_id=SUPERSESSION_SOURCE_PR_ID,
                    title="Shipment transitions use the shipping workflow",
                    rule_text="Use OrderWorkflow.shipOrder() for transitions to shipped.",
                    rationale="The specialized workflow emits shipment and audit events atomically.",
                    scope={"paths": ["src/orders/**"], "operations": ["transition to shipped"]},
                    actor_label="demo-maintainer",
                    memory_client=client,
                )
            else:
                document = session.get(MemoryDocument, "decision-DEC-0103")
                if document is None or document.ingestion_status != "ready":
                    from .hindsight_service import HindsightMemoryService

                    HindsightMemoryService(session, client).retain_decision(
                        "acme-commerce", SUPERSEDING_DECISION_ID
                    )
            run = ReviewService(session, model).run(pr_id=SUPERSESSION_CANDIDATE_PR_ID, memory_client=client)
            payload = serialize_review(session, run)
            states = {item.id: item.status for item in session.scalars(select(Decision)).all()}
        print(json.dumps({"feedback": None if feedback is None else {"id": feedback.id, "binding": feedback.binding}, "decision_states": states, "review": payload}, indent=2, sort_keys=True))
    finally:
        client.close()
        server.stop(timeout=60)
        model.close()

    current = [item for item in payload["findings"] if SUPERSEDING_DECISION_ID in item["evidence_ids"]]
    stale = [item for item in payload["findings"] if DECISION_ID in item["evidence_ids"]]
    passed = states.get(DECISION_ID) == "superseded" and states.get(SUPERSEDING_DECISION_ID) == "active" and bool(current) and not stale and (feedback is None or feedback.binding is False)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
