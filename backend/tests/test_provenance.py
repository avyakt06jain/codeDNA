from __future__ import annotations

from types import SimpleNamespace

import pytest

from codedna_memory.constants import ACME_REPOSITORY_SLUG, DOCUMENT_ID
from codedna_memory.database import (
    create_database_engine,
    initialize_schema,
    seed_synthetic_provenance,
    session_factory,
)
from codedna_memory.models import Decision, MemoryDocument
from codedna_memory.provenance import ProvenanceError, validate_recalled_fact


@pytest.fixture()
def seeded_session():
    engine = create_database_engine("sqlite+pysqlite:///:memory:")
    initialize_schema(engine)
    sessions = session_factory(engine)
    with sessions() as session:
        seed_synthetic_provenance(session)
        document = session.get(MemoryDocument, DOCUMENT_ID)
        assert document is not None
        document.ingestion_status = "ready"
        session.commit()
        yield session


def fact(**overrides):
    values = {
        "id": "fact-1",
        "document_id": DOCUMENT_ID,
        "chunk_id": "chunk-1",
        "metadata": {
            "repository_id": "repo-acme-commerce",
            "repository_slug": "acme-commerce",
            "decision_id": "DEC-0042",
            "source_pr_id": "pr-acme-42",
            "authority": "reviewer_confirmed",
            "fixture_type": "synthetic",
        },
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_valid_source_resolves(seeded_session):
    evidence = validate_recalled_fact(
        seeded_session,
        repository_slug=ACME_REPOSITORY_SLUG,
        fact=fact(),
    )
    assert evidence.decision_id == "DEC-0042"
    assert evidence.source_pr_id == "pr-acme-42"
    assert evidence.source_pr_number == 42


def test_missing_memory_document_is_rejected(seeded_session):
    with pytest.raises(ProvenanceError, match="memory_document_not_found"):
        validate_recalled_fact(
            seeded_session,
            repository_slug=ACME_REPOSITORY_SLUG,
            fact=fact(document_id="unknown-document"),
        )


def test_repository_mismatch_is_rejected(seeded_session):
    with pytest.raises(ProvenanceError, match="repository_mismatch"):
        validate_recalled_fact(
            seeded_session,
            repository_slug="analytics-service",
            fact=fact(),
        )


def test_inactive_decision_is_rejected(seeded_session):
    decision = seeded_session.get(Decision, "DEC-0042")
    assert decision is not None
    decision.status = "superseded"
    seeded_session.commit()
    with pytest.raises(ProvenanceError, match="decision_not_authoritative"):
        validate_recalled_fact(
            seeded_session,
            repository_slug=ACME_REPOSITORY_SLUG,
            fact=fact(),
        )


def test_metadata_mismatch_is_rejected(seeded_session):
    changed = fact()
    changed.metadata = {**changed.metadata, "decision_id": "DEC-FABRICATED"}
    with pytest.raises(ProvenanceError, match="metadata_mismatch:decision_id"):
        validate_recalled_fact(
            seeded_session,
            repository_slug=ACME_REPOSITORY_SLUG,
            fact=changed,
        )


def test_missing_source_pr_is_rejected(seeded_session):
    seeded_session.commit()
    # Deliberately corrupt the source reference through a raw connection to prove
    # that validation fails closed even if application storage is inconsistent.
    raw_connection = seeded_session.get_bind().raw_connection()
    try:
        raw_connection.execute("PRAGMA foreign_keys=OFF")
        raw_connection.execute(
            "UPDATE decisions SET source_pr_id = 'pr-missing' WHERE id = 'DEC-0042'"
        )
        raw_connection.commit()
        raw_connection.execute("PRAGMA foreign_keys=ON")
    finally:
        raw_connection.close()
    seeded_session.expire_all()

    with pytest.raises(ProvenanceError, match="source_pr_not_found"):
        validate_recalled_fact(
            seeded_session,
            repository_slug=ACME_REPOSITORY_SLUG,
            fact=fact(),
        )

