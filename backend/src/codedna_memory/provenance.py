from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Decision, MemoryDocument, PullRequest, Repository


@dataclass(frozen=True)
class ValidatedEvidence:
    fact_id: str
    document_id: str
    decision_id: str
    source_pr_id: str
    source_pr_number: int
    repository_id: str
    repository_slug: str
    bank_id: str
    chunk_id: str | None


class ProvenanceError(ValueError):
    """A recalled fact cannot be promoted to authoritative team evidence."""


def _field(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(name, default)
    return getattr(value, name, default)


def validate_recalled_fact(
    session: Session,
    *,
    repository_slug: str,
    fact: Any,
) -> ValidatedEvidence:
    repository = session.scalar(select(Repository).where(Repository.slug == repository_slug))
    if repository is None:
        raise ProvenanceError("repository_not_found")

    document_id = _field(fact, "document_id")
    if not document_id:
        raise ProvenanceError("missing_document_id")

    memory_document = session.get(MemoryDocument, document_id)
    if memory_document is None:
        raise ProvenanceError("memory_document_not_found")
    if memory_document.repository_id != repository.id:
        raise ProvenanceError("repository_mismatch")
    if memory_document.bank_id != repository.hindsight_bank_id:
        raise ProvenanceError("bank_mismatch")
    if memory_document.ingestion_status != "ready":
        raise ProvenanceError("memory_not_ready")

    decision = session.get(Decision, memory_document.decision_id)
    if decision is None:
        raise ProvenanceError("decision_not_found")
    if decision.repository_id != repository.id:
        raise ProvenanceError("decision_repository_mismatch")
    if decision.status != "active" or decision.authority != "reviewer_confirmed":
        raise ProvenanceError("decision_not_authoritative")

    source_pr = session.get(PullRequest, decision.source_pr_id)
    if source_pr is None:
        raise ProvenanceError("source_pr_not_found")
    if source_pr.repository_id != repository.id:
        raise ProvenanceError("source_pr_repository_mismatch")

    metadata = _field(fact, "metadata") or {}
    if not isinstance(metadata, Mapping):
        raise ProvenanceError("invalid_metadata")
    expected_metadata = {
        "repository_id": repository.id,
        "repository_slug": repository.slug,
        "decision_id": decision.id,
        "source_pr_id": source_pr.id,
        "authority": decision.authority,
        "fixture_type": "synthetic",
    }
    for key, expected in expected_metadata.items():
        if metadata.get(key) != expected:
            raise ProvenanceError(f"metadata_mismatch:{key}")

    return ValidatedEvidence(
        fact_id=str(_field(fact, "id", "")),
        document_id=document_id,
        decision_id=decision.id,
        source_pr_id=source_pr.id,
        source_pr_number=source_pr.number,
        repository_id=repository.id,
        repository_slug=repository.slug,
        bank_id=repository.hindsight_bank_id,
        chunk_id=_field(fact, "chunk_id"),
    )

