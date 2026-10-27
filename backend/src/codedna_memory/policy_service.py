from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from .constants import SUPERSEDING_DECISION_ID, SUPERSEDING_DOCUMENT_ID
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
