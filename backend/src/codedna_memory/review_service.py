from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .diff_parser import ParsedDiff, build_memory_query, parse_unified_diff
from .hindsight_service import HindsightMemoryService
from .models import Decision, Finding, FindingEvidence, PullRequest, Repository, ReviewRun
from .review_model import ReviewModel
from .review_schemas import CandidateFinding


def _elapsed_ms(started: float) -> int:
    return max(0, int((time.perf_counter() - started) * 1000))


def validate_candidate(
    candidate: CandidateFinding,
    *,
    parsed: ParsedDiff,
    allowed_decision_ids: set[str],
) -> str | None:
    if not parsed.allows(candidate.file_path, candidate.new_line):
        return "invalid_file_or_new_line"
    cited = set(candidate.evidence_ids)
    if candidate.category == "team_convention":
        if not cited:
            return "team_finding_missing_evidence"
        if not cited.issubset(allowed_decision_ids):
            return "team_finding_unallowlisted_evidence"
    elif cited:
        return "general_finding_has_evidence"
    return None


class ReviewService:
    def __init__(self, session: Session, model: ReviewModel) -> None:
        self._session = session
        self._model = model

    def run(
        self,
        *,
        pr_id: str,
        memory_client: Any | None,
    ) -> ReviewRun:
        started = time.perf_counter()
        pull_request = self._session.get(PullRequest, pr_id)
        if pull_request is None:
            raise ValueError("pull_request_not_found")
        repository = self._session.get(Repository, pull_request.repository_id)
        if repository is None:
            raise ValueError("repository_not_found")
        parsed = parse_unified_diff(pull_request.diff_text)
        mode = "memory" if memory_client is not None else "baseline"
        run = ReviewRun(
            id=f"review-{uuid.uuid4().hex[:16]}",
            pr_id=pr_id,
            mode=mode,
            provider=self._model.provider,
            model_name=self._model.model_name,
            status="running",
        )
        self._session.add(run)
        self._session.flush()

        retrieval: dict[str, Any] = {"query": None, "validated_evidence": []}
        evidence_prompt: list[dict[str, object]] = []
        fact_by_decision: dict[str, str] = {}
        query_ms = 0
        recall_ms = 0
        if memory_client is not None:
            query_started = time.perf_counter()
            query = build_memory_query(parsed)
            query_ms = _elapsed_ms(query_started)
            recall_started = time.perf_counter()
            recalled = HindsightMemoryService(
                self._session, memory_client
            ).recall_validated(repository.slug, query)
            recall_ms = _elapsed_ms(recall_started)
            retrieval = recalled
            for item in recalled["validated_evidence"]:
                decision = self._session.get(Decision, item["decision_id"])
                if decision is None:
                    continue
                evidence_prompt.append(
                    {
                        "decision_id": decision.id,
                        "source_pr_number": item["source_pr_number"],
                        "rule_text": decision.rule_text,
                        "rationale": decision.rationale,
                    }
                )
                fact_by_decision[decision.id] = item["fact_id"]

        generation_started = time.perf_counter()
        output = self._model.generate(parsed, evidence_prompt)
        generation_ms = _elapsed_ms(generation_started)
        allowed = set(fact_by_decision)
        dropped: list[dict[str, str]] = []
        validation_started = time.perf_counter()
        for candidate in output.findings:
            reason = validate_candidate(
                candidate, parsed=parsed, allowed_decision_ids=allowed
            )
            if reason:
                dropped.append({"title": candidate.title, "reason": reason})
                continue
            finding = Finding(
                id=f"finding-{uuid.uuid4().hex[:16]}",
                review_run_id=run.id,
                file_path=candidate.file_path,
                new_line=candidate.new_line,
                severity=candidate.severity,
                category=candidate.category,
                title=candidate.title,
                explanation=candidate.explanation,
                suggested_change=candidate.suggested_change,
                confidence=candidate.confidence,
            )
            self._session.add(finding)
            self._session.flush()
            for decision_id in candidate.evidence_ids:
                self._session.add(
                    FindingEvidence(
                        finding_id=finding.id,
                        decision_id=decision_id,
                        memory_fact_id=fact_by_decision.get(decision_id),
                    )
                )
        validation_ms = _elapsed_ms(validation_started)
        retrieval["timings_ms"] = {
            "query": query_ms,
            "recall": recall_ms,
            "validation": validation_ms,
            "generation": generation_ms,
        }

        run.status = "complete"
        run.retrieval_trace_json = json.dumps(retrieval, sort_keys=True, default=str)
        run.validation_trace_json = json.dumps({"dropped": dropped}, sort_keys=True)
        run.elapsed_ms = int((time.perf_counter() - started) * 1000)
        self._session.commit()
        return run


def serialize_review(session: Session, run: ReviewRun) -> dict[str, Any]:
    findings = session.scalars(
        select(Finding).where(Finding.review_run_id == run.id)
    ).all()
    result_findings: list[dict[str, Any]] = []
    for finding in findings:
        evidence = session.scalars(
            select(FindingEvidence).where(FindingEvidence.finding_id == finding.id)
        ).all()
        result_findings.append(
            {
                "id": finding.id,
                "category": finding.category,
                "file_path": finding.file_path,
                "new_line": finding.new_line,
                "severity": finding.severity,
                "title": finding.title,
                "explanation": finding.explanation,
                "suggested_change": finding.suggested_change,
                "confidence": finding.confidence,
                "evidence_ids": [item.decision_id for item in evidence],
            }
        )
    retrieval = json.loads(run.retrieval_trace_json)
    payload = {
        "run_id": run.id,
        "status": run.status,
        "mode": run.mode,
        "model": run.model_name,
        "provider": run.provider,
        "pr_id": run.pr_id,
        "elapsed_ms": run.elapsed_ms,
        "retrieval": retrieval,
        "validation": json.loads(run.validation_trace_json),
        "findings": result_findings,
    }
    stored_timings = retrieval.get("timings_ms")
    if isinstance(stored_timings, dict):
        payload["timings_ms"] = stored_timings
    return payload
