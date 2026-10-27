from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from .constants import (
    ACME_BANK_ID,
    ACME_REPOSITORY_ID,
    ACME_REPOSITORY_SLUG,
    ANALYTICS_BANK_ID,
    ANALYTICS_REPOSITORY_ID,
    ANALYTICS_REPOSITORY_SLUG,
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
    if session.get(PullRequest, CANDIDATE_PR_ID) is None:
        session.add(
            PullRequest(
                id=CANDIDATE_PR_ID,
                repository_id=ACME_REPOSITORY_ID,
                number=87,
                title="Mark fulfilled orders as shipped",
                description="Synthetic held-out candidate PR; it contains no historical answer.",
                diff_text=(
                    "--- a/src/orders/update.ts\n+++ b/src/orders/update.ts\n"
                    "@@ -17,0 +18,3 @@\n+await prisma.order.update({\n"
                    "+  data: { status: 'shipped' },\n+});\n"
                ),
                created_at=datetime(2026, 10, 20, tzinfo=timezone.utc),
            )
        )
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
    session.commit()

