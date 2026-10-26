from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    hindsight_bank_id: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)

    pull_requests: Mapped[list[PullRequest]] = relationship(back_populates="repository")
    decisions: Mapped[list[Decision]] = relationship(back_populates="repository")


class PullRequest(Base):
    __tablename__ = "pull_requests"
    __table_args__ = (UniqueConstraint("repository_id", "number"),)

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), nullable=False)
    number: Mapped[int] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    diff_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)

    repository: Mapped[Repository] = relationship(back_populates="pull_requests")


class Decision(Base):
    __tablename__ = "decisions"
    __table_args__ = (
        CheckConstraint("authority IN ('proposed', 'reviewer_confirmed')"),
        CheckConstraint("status IN ('proposed', 'active', 'superseded', 'revoked')"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), nullable=False)
    source_pr_id: Mapped[str] = mapped_column(ForeignKey("pull_requests.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    rule_text: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    scope_json: Mapped[str] = mapped_column(Text, nullable=False)
    authority: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    effective_at: Mapped[datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)

    repository: Mapped[Repository] = relationship(back_populates="decisions")
    source_pr: Mapped[PullRequest] = relationship()


class MemoryDocument(Base):
    __tablename__ = "memory_documents"
    __table_args__ = (
        CheckConstraint("ingestion_status IN ('pending', 'processing', 'ready', 'failed')"),
        UniqueConstraint("repository_id", "decision_id"),
    )

    document_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), nullable=False)
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), nullable=False)
    bank_id: Mapped[str] = mapped_column(String(160), nullable=False)
    ingestion_status: Mapped[str] = mapped_column(String(40), nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)

    repository: Mapped[Repository] = relationship()
    decision: Mapped[Decision] = relationship()

