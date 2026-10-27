from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from hindsight_client import Hindsight
from dotenv import load_dotenv

from .constants import (
    ACME_REPOSITORY_SLUG,
    ANALYTICS_REPOSITORY_SLUG,
    DECISION_ID,
    DOCUMENT_ID,
    RECALL_QUERY,
)
from .database import create_database_engine, initialize_schema, seed_synthetic_provenance, session_factory
from .hindsight_service import HindsightMemoryService

DEFAULT_DATABASE_URL = "sqlite:///./data/codedna.sqlite3"
DEFAULT_HINDSIGHT_URL = "http://127.0.0.1:8888"
DEFAULT_HINDSIGHT_DATABASE_URL = "pg0"


def _version_payload(version: Any) -> dict[str, Any]:
    if hasattr(version, "model_dump"):
        raw = version.model_dump(mode="json")
        return raw if isinstance(raw, dict) else {"value": str(raw)}
    if hasattr(version, "to_dict"):
        raw = version.to_dict()
        return raw if isinstance(raw, dict) else {"value": str(raw)}
    return {"value": str(version)}


def _emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True, default=str))


def _load_local_environment() -> None:
    for candidate in (Path.cwd() / ".env", Path.cwd().parent / ".env"):
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            return


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the real CodeDNA Hindsight G1 smoke checks.")
    parser.add_argument(
        "operation",
        choices=("seed-and-recall", "recall-only", "isolation-check"),
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("CODEDNA_DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument(
        "--hindsight-url",
        default=os.getenv("HINDSIGHT_API_URL", DEFAULT_HINDSIGHT_URL),
    )
    parser.add_argument(
        "--runtime",
        choices=("http", "in-process"),
        default=os.getenv("CODEDNA_HINDSIGHT_RUNTIME", "http"),
        help="Use an existing HTTP service or own an official in-process Hindsight server.",
    )
    parser.add_argument(
        "--hindsight-database-url",
        default=os.getenv(
            "HINDSIGHT_API_DATABASE_URL", DEFAULT_HINDSIGHT_DATABASE_URL
        ),
    )
    parser.add_argument(
        "--hindsight-provider",
        default=os.getenv("HINDSIGHT_API_LLM_PROVIDER"),
    )
    parser.add_argument(
        "--hindsight-model",
        default=os.getenv("HINDSIGHT_API_LLM_MODEL"),
    )
    parser.add_argument(
        "--startup-timeout",
        type=float,
        default=180.0,
    )
    return parser


@contextmanager
def _hindsight_client(args: argparse.Namespace) -> Iterator[Hindsight]:
    if args.runtime == "http":
        client = Hindsight(base_url=args.hindsight_url, timeout=60.0)
        try:
            yield client
        finally:
            client.close()
        return

    provider = args.hindsight_provider
    model = args.hindsight_model
    api_key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    if not provider or not model or not api_key:
        raise ValueError(
            "in_process_runtime_requires_provider_model_and_api_key"
        )

    from hindsight import HindsightServer

    server = HindsightServer(
        db_url=args.hindsight_database_url,
        llm_provider=provider,
        llm_api_key=api_key,
        llm_model=model,
        log_level="warning",
    )
    server.start(timeout=args.startup_timeout)
    client = Hindsight(base_url=server.url, timeout=60.0)
    try:
        yield client
    finally:
        client.close()
        # Retain can leave consolidation cleanup briefly active. Give the
        # official server time to close pg0 and its worker thread deterministically.
        server.stop(timeout=60.0)


def _safe_error_message(exc: Exception) -> str:
    message = str(exc)
    api_key = os.getenv("HINDSIGHT_API_LLM_API_KEY")
    return message.replace(api_key, "[REDACTED]") if api_key else message


def run(args: argparse.Namespace) -> int:
    if args.database_url.startswith("sqlite:///./"):
        relative_path = args.database_url.removeprefix("sqlite:///./")
        Path(relative_path).parent.mkdir(parents=True, exist_ok=True)

    engine = create_database_engine(args.database_url)
    initialize_schema(engine)
    sessions = session_factory(engine)

    try:
        with _hindsight_client(args) as client, sessions() as session:
            if args.operation == "seed-and-recall":
                seed_synthetic_provenance(session)
            service = HindsightMemoryService(session, client)
            version = service.get_version()
            if args.operation == "seed-and-recall":
                service.ensure_repository_bank(ACME_REPOSITORY_SLUG)
                service.ensure_repository_bank(ANALYTICS_REPOSITORY_SLUG)
                service.retain_demo_decision(ACME_REPOSITORY_SLUG)
                result = service.recall_validated(ACME_REPOSITORY_SLUG, RECALL_QUERY)
                document_count = service.exact_document_count(
                    ACME_REPOSITORY_SLUG, DOCUMENT_ID
                )
                result["exact_document_count"] = document_count
                source_resolved = any(
                    item["decision_id"] == DECISION_ID
                    and item["document_id"] == DOCUMENT_ID
                    for item in result["validated_evidence"]
                )
                source_chunk_present = any(
                    item["document_id"] == DOCUMENT_ID and item["chunk_present"]
                    for item in result["raw_results"]
                )
                passed = source_resolved and source_chunk_present and document_count == 1
                if not source_resolved:
                    reason = "no_validated_source"
                elif not source_chunk_present:
                    reason = "source_chunk_missing"
                elif document_count != 1:
                    reason = "duplicate_or_missing_document"
                else:
                    reason = "validated_source_resolved"
            elif args.operation == "recall-only":
                result = service.recall_validated(ACME_REPOSITORY_SLUG, RECALL_QUERY)
                document_count = service.exact_document_count(
                    ACME_REPOSITORY_SLUG, DOCUMENT_ID
                )
                result["exact_document_count"] = document_count
                source_resolved = any(
                    item["decision_id"] == DECISION_ID
                    and item["document_id"] == DOCUMENT_ID
                    for item in result["validated_evidence"]
                )
                source_chunk_present = any(
                    item["document_id"] == DOCUMENT_ID and item["chunk_present"]
                    for item in result["raw_results"]
                )
                passed = source_resolved and source_chunk_present and document_count == 1
                if not source_resolved:
                    reason = "persisted_source_missing"
                elif not source_chunk_present:
                    reason = "persisted_source_chunk_missing"
                elif document_count != 1:
                    reason = "duplicate_or_missing_document"
                else:
                    reason = "persisted_source_resolved"
            else:
                result = service.recall_validated(ANALYTICS_REPOSITORY_SLUG, RECALL_QUERY)
                leaked = any(
                    raw["document_id"] == DOCUMENT_ID for raw in result["raw_results"]
                ) or any(
                    item["decision_id"] == DECISION_ID
                    for item in result["validated_evidence"]
                )
                passed = not leaked
                reason = "bank_isolated" if passed else "cross_bank_leakage"

            _emit(
                {
                    "status": "pass" if passed else "fail",
                    "reason": reason,
                    "operation": args.operation,
                    "versions": {
                        "hindsight_client": importlib.metadata.version("hindsight-client"),
                        "hindsight_api": _version_payload(version),
                    },
                    "result": result,
                }
            )
            return 0 if passed else 1
    except Exception as exc:
        _emit(
            {
                "status": "fail",
                "reason": "service_error",
                "operation": args.operation,
                "error": {
                    "type": type(exc).__name__,
                    "message": _safe_error_message(exc),
                },
            }
        )
        return 2


def main() -> None:
    _load_local_environment()
    sys.exit(run(_build_parser().parse_args()))


if __name__ == "__main__":
    main()

