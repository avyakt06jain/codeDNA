from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from hindsight import HindsightServer
from hindsight_client import Hindsight
from hindsight_client_api.exceptions import NotFoundException

from .database import (
    create_database_engine,
    initialize_schema,
    seed_synthetic_provenance,
    session_factory,
)
from .models import Base


DEMO_BANKS = ("codedna-repo-acme-commerce", "codedna-repo-analytics-service")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset only CodeDNA synthetic demo state")
    parser.add_argument("--confirm-demo-reset", action="store_true")
    args = parser.parse_args()
    if not args.confirm_demo_reset:
        raise SystemExit("Refusing reset without --confirm-demo-reset")
    for candidate in (Path.cwd() / ".env", Path.cwd().parent / ".env"):
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            break
    key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    if not key:
        raise SystemExit("HINDSIGHT_API_LLM_API_KEY is required")
    database_url = os.getenv("CODEDNA_DATABASE_URL", "sqlite:///./data/codedna.sqlite3")
    engine = create_database_engine(database_url)
    if engine.url.get_backend_name() != "sqlite" or not str(engine.url.database).endswith(
        "codedna.sqlite3"
    ):
        raise SystemExit("Refusing reset: target is not the designated CodeDNA demo SQLite DB")

    server = HindsightServer(
        db_url=os.getenv("HINDSIGHT_API_DATABASE_URL", "pg0"),
        llm_provider=os.getenv("HINDSIGHT_API_LLM_PROVIDER", "gemini"),
        llm_api_key=key,
        llm_model=os.getenv("HINDSIGHT_API_LLM_MODEL", "gemini-3.1-flash-lite"),
        log_level="warning",
    ).start(timeout=180)
    client = Hindsight(base_url=server.url, timeout=60)
    deleted_banks: list[str] = []
    try:
        for bank_id in DEMO_BANKS:
            try:
                client.delete_bank(bank_id)
                deleted_banks.append(bank_id)
            except NotFoundException:
                pass
    finally:
        client.close()
        server.stop(timeout=60)

    Base.metadata.drop_all(engine)
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
    print(
        json.dumps(
            {
                "status": "reset",
                "deleted_banks": deleted_banks,
                "seeded_repositories": ["acme-commerce", "analytics-service"],
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
