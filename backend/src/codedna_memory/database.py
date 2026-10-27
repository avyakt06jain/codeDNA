from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from .constants import (
    ACME_BANK_ID,
    ACME_REPOSITORY_ID,
    ACME_REPOSITORY_SLUG,
    ANALYTICS_BANK_ID,
    ANALYTICS_DECISION_ID,
    ANALYTICS_DOCUMENT_ID,
    ANALYTICS_PR_DIFF,
    ANALYTICS_PR_ID,
    ANALYTICS_REPOSITORY_ID,
    ANALYTICS_REPOSITORY_SLUG,
    CANDIDATE_PR_DIFF,
    CANDIDATE_PR_ID,
    DECISION_ID,
    DOCUMENT_ID,
    SOURCE_PR_ID,
    SUPERSESSION_CANDIDATE_PR_ID,
    SUPERSESSION_SOURCE_PR_ID,
)
from .models import Base, Decision, MemoryDocument, PullRequest, Repository


def create_database_engine(database_url: str) -> Engine:
    url = make_url(database_url)
    if url.get_backend_name() == "sqlite" and url.database not in (None, ":memory:"):
        Path(url.database).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(database_url)
    if url.get_backend_name() == "sqlite":

        @event.listens_for(engine, "connect")
        def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def initialize_schema(engine: Engine) -> None:
    Base.metadata.create_all(engine)
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as connection:
        _add_column_if_missing(
            connection, "decisions", "supersedes_decision_id", "VARCHAR(80)"
        )
        _add_column_if_missing(
            connection,
            "review_jobs",
            "kind",
            "VARCHAR(24) NOT NULL DEFAULT 'review'",
        )
        _add_column_if_missing(
            connection, "review_jobs", "baseline_run_id", "VARCHAR(80)"
        )
        _backfill_supersedes_decision_id(connection)


def _column_names(connection, table: str) -> set[str]:
    rows = connection.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add_column_if_missing(connection, table: str, column: str, ddl: str) -> None:
    names = _column_names(connection, table)
    if not names or column in names:
        return
    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def _backfill_supersedes_decision_id(connection) -> None:
    if "supersedes_decision_id" not in _column_names(connection, "decisions"):
        return
    rows = connection.execute(
        text("SELECT id, scope_json, supersedes_decision_id FROM decisions")
    ).fetchall()
    for row in rows:
        if row[2]:
            continue
        try:
            scope = json.loads(row[1] or "")
        except json.JSONDecodeError:
            continue
        if not isinstance(scope, dict):
            continue
        previous = scope.get("supersedes")
        if isinstance(previous, str) and previous:
            connection.execute(
                text(
                    "UPDATE decisions SET supersedes_decision_id = :previous "
                    "WHERE id = :decision_id"
                ),
                {"previous": previous, "decision_id": row[0]},
            )


def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def seed_synthetic_provenance(session: Session) -> None:
    acme = session.get(Repository, ACME_REPOSITORY_ID)
    if acme is None:
        session.add(
            Repository(
                id=ACME_REPOSITORY_ID,
                slug=ACME_REPOSITORY_SLUG,
                display_name="Acme Commerce (synthetic)",
                hindsight_bank_id=ACME_BANK_ID,
            )
        )
    analytics = session.get(Repository, ANALYTICS_REPOSITORY_ID)
    if analytics is None:
        session.add(
            Repository(
                id=ANALYTICS_REPOSITORY_ID,
                slug=ANALYTICS_REPOSITORY_SLUG,
                display_name="Analytics Service (synthetic)",
                hindsight_bank_id=ANALYTICS_BANK_ID,
            )
        )
    session.flush()

    if session.get(PullRequest, SOURCE_PR_ID) is None:
        session.add(
            PullRequest(
                id=SOURCE_PR_ID,
                repository_id=ACME_REPOSITORY_ID,
                number=42,
                title="Preserve audit events for order status transitions",
                description=(
                    "Synthetic historical review confirming the repository-specific "
                    "order transition workflow."
                ),
                diff_text=(
                    "--- a/src/orders/update.ts\n+++ b/src/orders/update.ts\n"
                    "@@ -10,1 +10,1 @@\n-prisma.order.update(...)\n"
                    "+OrderService.transitionOrder(...)\n"
                ),
                created_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
            )
        )
    candidate = session.get(PullRequest, CANDIDATE_PR_ID)
    if candidate is None:
        session.add(
            PullRequest(
                id=CANDIDATE_PR_ID,
                repository_id=ACME_REPOSITORY_ID,
                number=87,
                title="Mark fulfilled orders as shipped",
                description="Synthetic held-out candidate PR; it contains no historical answer.",
                diff_text=CANDIDATE_PR_DIFF,
                created_at=datetime(2026, 10, 20, tzinfo=timezone.utc),
            )
        )
    else:
        candidate.diff_text = CANDIDATE_PR_DIFF
    if session.get(PullRequest, SUPERSESSION_SOURCE_PR_ID) is None:
        session.add(
            PullRequest(
                id=SUPERSESSION_SOURCE_PR_ID,
                repository_id=ACME_REPOSITORY_ID,
                number=103,
                title="Specialize shipped-order transitions",
                description="Synthetic maintainer source for an explicit policy supersession.",
                diff_text=(
                    "--- a/src/orders/shipping.ts\n+++ b/src/orders/shipping.ts\n"
                    "@@ -8,1 +8,1 @@\n-OrderService.transitionOrder(orderId, 'shipped')\n"
                    "+OrderWorkflow.shipOrder(orderId)\n"
                ),
                created_at=datetime(2026, 10, 22, tzinfo=timezone.utc),
            )
        )
    if session.get(PullRequest, SUPERSESSION_CANDIDATE_PR_ID) is None:
        session.add(
            PullRequest(
                id=SUPERSESSION_CANDIDATE_PR_ID,
                repository_id=ACME_REPOSITORY_ID,
                number=120,
                title="Ship replacement orders",
                description="Synthetic held-out candidate for the supersession proof.",
                diff_text=(
                    "--- a/src/orders/replacements.ts\n+++ b/src/orders/replacements.ts\n"
                    "@@ -30,0 +31,1 @@\n+await OrderService.transitionOrder(orderId, 'shipped');\n"
                ),
                created_at=datetime(2026, 10, 25, tzinfo=timezone.utc),
            )
        )
    session.flush()

    if session.get(Decision, DECISION_ID) is None:
        session.add(
            Decision(
                id=DECISION_ID,
                repository_id=ACME_REPOSITORY_ID,
                source_pr_id=SOURCE_PR_ID,
                title="Order status changes must emit audit events",
                rule_text="Use OrderService.transitionOrder() for order status changes.",
                rationale="Direct Prisma status updates bypass required audit-event emission.",
                scope_json=json.dumps(
                    {
                        "paths": ["src/orders/**"],
                        "operations": ["order status mutation"],
                    },
                    sort_keys=True,
                ),
                authority="reviewer_confirmed",
                status="active",
                effective_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
            )
        )
    session.flush()

    if session.get(MemoryDocument, DOCUMENT_ID) is None:
        session.add(
            MemoryDocument(
                document_id=DOCUMENT_ID,
                repository_id=ACME_REPOSITORY_ID,
                decision_id=DECISION_ID,
                bank_id=ACME_BANK_ID,
                ingestion_status="pending",
            )
        )
    if session.get(PullRequest, ANALYTICS_PR_ID) is None:
        session.add(
            PullRequest(
                id=ANALYTICS_PR_ID,
                repository_id=ANALYTICS_REPOSITORY_ID,
                number=11,
                title="Store analytics timestamps in UTC",
                description="Synthetic analytics-service history for timestamp handling.",
                diff_text=ANALYTICS_PR_DIFF,
                created_at=datetime(2026, 10, 18, tzinfo=timezone.utc),
            )
        )
    session.flush()
    if session.get(Decision, ANALYTICS_DECISION_ID) is None:
        session.add(
            Decision(
                id=ANALYTICS_DECISION_ID,
                repository_id=ANALYTICS_REPOSITORY_ID,
                source_pr_id=ANALYTICS_PR_ID,
                title="Analytics timestamps are stored in UTC",
                rule_text="Store and compare analytics event timestamps in UTC.",
                rationale=(
                    "Local clock strings drift across regions and make event "
                    "windows impossible to audit."
                ),
                scope_json=json.dumps(
                    {
                        "paths": ["src/events/**"],
                        "operations": ["timestamp persistence"],
                    },
                    sort_keys=True,
                ),
                authority="reviewer_confirmed",
                status="active",
                effective_at=datetime(2026, 10, 18, tzinfo=timezone.utc),
            )
        )
    session.flush()
    if session.get(MemoryDocument, ANALYTICS_DOCUMENT_ID) is None:
        session.add(
            MemoryDocument(
                document_id=ANALYTICS_DOCUMENT_ID,
                repository_id=ANALYTICS_REPOSITORY_ID,
                decision_id=ANALYTICS_DECISION_ID,
                bank_id=ANALYTICS_BANK_ID,
                ingestion_status="pending",
            )
        )
    session.commit()

