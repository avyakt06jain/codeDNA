from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from .constants import (
    DECISION_ID,
    SHIPPING_DECISION_RATIONALE,
    SHIPPING_DECISION_RULE,
    SHIPPING_DECISION_SCOPE,
    SHIPPING_DECISION_TITLE,
    SUPERSEDING_DECISION_ID,
    SUPERSEDING_DOCUMENT_ID,
    SUPERSESSION_SOURCE_PR_ID,
)
from .hindsight_service import HindsightMemoryService
from .models import Decision, FeedbackEvent, Finding, MemoryDocument, PullRequest, Repository


def record_feedback(
    session: Session,
    *,
    finding_id: str,
    action: str,
    actor_label: str,
    reason: str | None,
    confirm_as_policy: bool,
) -> FeedbackEvent:
    if confirm_as_policy:
        raise ValueError("feedback_cannot_directly_create_policy")
    if session.get(Finding, finding_id) is None:
        raise ValueError("finding_not_found")
    event = FeedbackEvent(
        id=f"feedback-{uuid.uuid4().hex[:16]}",
        finding_id=finding_id,
        action=action,
        actor_label=actor_label,
        reason=reason,
        binding=False,
    )
    session.add(event)
    session.commit()
    return event


def supersede_decision(
    session: Session,
    *,
    decision_id: str,
    source_pr_id: str,
    title: str,
    rule_text: str,
    rationale: str,
    scope: dict[str, object],
    actor_label: str,
    memory_client: Any | None = None,
) -> Decision:
    previous = session.get(Decision, decision_id)
    if previous is None or previous.status != "active":
        raise ValueError("active_decision_not_found")
    source = session.get(PullRequest, source_pr_id)
    if source is None or source.repository_id != previous.repository_id:
        raise ValueError("supersession_source_pr_mismatch")
    if actor_label != "demo-maintainer":
        raise ValueError("maintainer_authority_required")
    if session.get(Decision, SUPERSEDING_DECISION_ID) is not None:
        raise ValueError("superseding_decision_already_exists")
    repository = session.get(Repository, previous.repository_id)
    if repository is None:
        raise ValueError("repository_not_found")

    previous.status = "superseded"
    replacement = Decision(
        id=SUPERSEDING_DECISION_ID,
        repository_id=previous.repository_id,
        source_pr_id=source.id,
        title=title,
        rule_text=rule_text,
        rationale=rationale,
        scope_json=json.dumps({**scope, "supersedes": previous.id}, sort_keys=True),
        authority="reviewer_confirmed",
        status="active",
        effective_at=source.created_at,
        supersedes_decision_id=previous.id,
    )
    session.add(replacement)
    session.flush()
    session.add(
        MemoryDocument(
            document_id=SUPERSEDING_DOCUMENT_ID,
            repository_id=repository.id,
            decision_id=replacement.id,
            bank_id=repository.hindsight_bank_id,
            ingestion_status="pending",
        )
    )
    session.commit()
    if memory_client is not None:
        HindsightMemoryService(session, memory_client).retain_decision(
            repository.slug, replacement.id
        )
    return replacement


def prepare_evolved_demo(session: Session, memory_client: Any | None = None) -> Decision:
    """Apply the shipping-workflow scene once. A second call only retries a failed retain."""
    existing = session.get(Decision, SUPERSEDING_DECISION_ID)
    if existing is None:
        return supersede_decision(
            session,
            decision_id=DECISION_ID,
            source_pr_id=SUPERSESSION_SOURCE_PR_ID,
            title=SHIPPING_DECISION_TITLE,
            rule_text=SHIPPING_DECISION_RULE,
            rationale=SHIPPING_DECISION_RATIONALE,
            scope=dict(SHIPPING_DECISION_SCOPE),
            actor_label="demo-maintainer",
            memory_client=memory_client,
        )
    document = session.get(MemoryDocument, SUPERSEDING_DOCUMENT_ID)
    if (
        memory_client is not None
        and document is not None
        and document.ingestion_status == "failed"
    ):
        repository = session.get(Repository, existing.repository_id)
        if repository is None:
            raise ValueError("repository_not_found")
        HindsightMemoryService(session, memory_client).retain_decision(
            repository.slug, existing.id
        )
    return existing
