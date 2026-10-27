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
