from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from hindsight import HindsightServer
from hindsight_client import Hindsight

from .constants import CANDIDATE_PR_ID
from .database import create_database_engine, initialize_schema, seed_synthetic_provenance, session_factory
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

    model = GeminiReviewModel(api_key=key, model_name=model_name)
    server = HindsightServer(
        db_url=os.getenv("HINDSIGHT_API_DATABASE_URL", "pg0"),
        llm_provider=os.getenv("HINDSIGHT_API_LLM_PROVIDER", "gemini"),
        llm_api_key=key,
        llm_model=os.getenv("HINDSIGHT_API_LLM_MODEL", model_name),
        log_level="warning",
    ).start(timeout=180)
    client = Hindsight(base_url=server.url, timeout=60)
    try:
        with sessions() as session:
            memory_run = ReviewService(session, model).run(
                pr_id=CANDIDATE_PR_ID, memory_client=client
            )
            memory_payload = serialize_review(session, memory_run)
        with sessions() as session:
            baseline_run = ReviewService(session, model).run(
                pr_id=CANDIDATE_PR_ID, memory_client=None
            )
            baseline_payload = serialize_review(session, baseline_run)
        print(json.dumps({"memory": memory_payload, "baseline": baseline_payload}, indent=2, sort_keys=True))
    finally:
        client.close()
        server.stop(timeout=60)
        model.close()

    memory_team = [item for item in memory_payload["findings"] if item["category"] == "team_convention" and "DEC-0042" in item["evidence_ids"]]
    baseline_leaks = [item for item in baseline_payload["findings"] if item["evidence_ids"] or item["category"] == "team_convention"]
    sys.exit(0 if memory_team and not baseline_leaks else 1)


if __name__ == "__main__":
    main()
