from __future__ import annotations

import asyncio
from dataclasses import asdict
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from .constants import DECISION_CONTENT, DECISION_ID, DOCUMENT_ID
from .models import Decision, MemoryDocument, PullRequest, Repository
from .provenance import ProvenanceError, validate_recalled_fact


class HindsightClient(Protocol):
    documents: Any

    def get_version(self) -> Any: ...

    def create_bank(self, *, bank_id: str, name: str, **kwargs: Any) -> Any: ...

    def retain(self, **kwargs: Any) -> Any: ...

    def recall(self, **kwargs: Any) -> Any: ...


class HindsightMemoryService:
    def __init__(self, session: Session, client: HindsightClient) -> None:
        self._session = session
        self._client = client

    def get_version(self) -> Any:
        return self._client.get_version()

    def _repository(self, repository_slug: str) -> Repository:
        repository = self._session.scalar(
            select(Repository).where(Repository.slug == repository_slug)
        )
        if repository is None:
            raise ValueError("repository_not_found")
        return repository

    def ensure_repository_bank(self, repository_slug: str) -> str:
        repository = self._repository(repository_slug)
        try:
            self._client.create_bank(
                bank_id=repository.hindsight_bank_id,
                name=f"CodeDNA: {repository.display_name}",
            )
        except Exception as exc:
            if getattr(exc, "status", None) != 409:
                raise
        return repository.hindsight_bank_id

    def exact_document_count(self, repository_slug: str, document_id: str) -> int:
        repository = self._repository(repository_slug)

        async def list_documents() -> Any:
            return await self._client.documents.list_documents(
                bank_id=repository.hindsight_bank_id,
                q=document_id,
                limit=100,
                offset=0,
            )

        # Keep generated-client calls on the same loop used by Hindsight's sync
        # wrappers. asyncio.run() creates and closes a second loop, leaving the
        # shared aiohttp session impossible to close cleanly on Windows.
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        response = loop.run_until_complete(list_documents())
        return sum(1 for item in response.items if item.id == document_id)

    def retain_demo_decision(self, repository_slug: str) -> Any:
        return self.retain_decision(repository_slug, DECISION_ID)

    def retain_decision(self, repository_slug: str, decision_id: str) -> Any:
        repository = self._repository(repository_slug)
        decision = self._session.get(Decision, decision_id)
        document = self._session.scalar(
            select(MemoryDocument).where(MemoryDocument.decision_id == decision_id)
        )
        if decision is None or document is None:
            raise ValueError("demo_provenance_not_seeded")
        if decision.repository_id != repository.id or document.repository_id != repository.id:
            raise ValueError("demo_provenance_repository_mismatch")
        source_pr = self._session.get(PullRequest, decision.source_pr_id)
        if source_pr is None:
            raise ValueError("source_pr_not_found")

        document.ingestion_status = "processing"
        document.last_error = None
        self._session.commit()
        try:
            result = self._client.retain(
                bank_id=repository.hindsight_bank_id,
                document_id=document.document_id,
                context="Confirmed synthetic engineering decision from historical PR review",
                metadata={
                    "repository_id": repository.id,
                    "repository_slug": repository.slug,
                    "decision_id": decision.id,
                    "source_pr_id": source_pr.id,
                    "authority": decision.authority,
                    "fixture_type": "synthetic",
                },
                content=(
                    DECISION_CONTENT
                    if decision.id == DECISION_ID
                    else f"Confirmed engineering decision: {decision.rule_text} Rationale: {decision.rationale}"
                ),
                retain_async=False,
            )
        except Exception as exc:
            document.ingestion_status = "failed"
            document.last_error = f"{type(exc).__name__}: {exc}"[:2000]
            self._session.commit()
            raise

        document.ingestion_status = "ready"
        self._session.commit()
        return result

    def recall_validated(self, repository_slug: str, query: str) -> dict[str, Any]:
        repository = self._repository(repository_slug)
        response = self._client.recall(
            bank_id=repository.hindsight_bank_id,
            query=query,
            types=["world", "experience"],
            budget="mid",
            max_tokens=2000,
            include_chunks=True,
            max_chunk_tokens=500,
        )

        validated: list[dict[str, Any]] = []
        rejected: list[dict[str, str]] = []
        chunks = getattr(response, "chunks", None) or {}
        seen_documents: set[str] = set()
        duplicate_document_results = 0
        raw_results: list[dict[str, Any]] = []

        for fact in getattr(response, "results", None) or []:
            document_id = getattr(fact, "document_id", None)
            if document_id in seen_documents:
                duplicate_document_results += 1
            elif document_id:
                seen_documents.add(document_id)
            chunk_id = getattr(fact, "chunk_id", None)
            raw_results.append(
                {
                    "fact_id": str(getattr(fact, "id", "")),
                    "document_id": document_id,
                    "chunk_id": chunk_id,
                    "chunk_present": bool(chunk_id and chunks.get(chunk_id)),
                }
            )
            try:
                validated.append(
                    asdict(
                        validate_recalled_fact(
                            self._session,
                            repository_slug=repository_slug,
                            fact=fact,
                        )
                    )
                )
            except ProvenanceError as exc:
                rejected.append(
                    {
                        "fact_id": str(getattr(fact, "id", "")),
                        "reason": str(exc),
                    }
                )

        return {
            "bank_id": repository.hindsight_bank_id,
            "query": query,
            "raw_results": raw_results,
            "validated_evidence": validated,
            "rejected_evidence": rejected,
            "distinct_document_ids": sorted(seen_documents),
            "duplicate_document_results": duplicate_document_results,
        }

