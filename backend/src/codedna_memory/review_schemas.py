from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CandidateFinding(BaseModel):
    file_path: str = Field(min_length=1, max_length=500)
    new_line: int | None = Field(default=None, ge=1)
    severity: Literal["info", "warning", "error"]
    category: Literal["general", "team_convention"]
    title: str = Field(min_length=8, max_length=140)
    explanation: str = Field(min_length=20, max_length=2000)
    suggested_change: str | None = Field(default=None, max_length=2000)
    confidence: Literal["low", "medium", "high"]
    evidence_ids: list[str] = Field(default_factory=list, max_length=5)


class ReviewModelOutput(BaseModel):
    findings: list[CandidateFinding] = Field(default_factory=list, max_length=10)


class ReviewRequest(BaseModel):
    memory_enabled: bool = True


class ReviewCreated(BaseModel):
    run_id: str
    status: Literal["complete", "degraded", "failed"]
    mode: Literal["baseline", "memory"]


class FeedbackRequest(BaseModel):
    action: Literal["accepted", "rejected", "not_applicable", "corrected"]
    reason: str | None = Field(default=None, max_length=2000)
    actor_label: str = Field(min_length=2, max_length=120)
    confirm_as_policy: bool = False


class SupersedeRequest(BaseModel):
    source_pr_id: str
    title: str = Field(min_length=8, max_length=240)
    rule_text: str = Field(min_length=12, max_length=2000)
    rationale: str = Field(min_length=12, max_length=2000)
    scope: dict[str, object]
    actor_label: str = Field(min_length=2, max_length=120)
