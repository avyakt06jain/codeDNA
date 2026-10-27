from __future__ import annotations

from typing import Any


def evaluate_comparison(
    memory: dict[str, Any], baseline: dict[str, Any]
) -> dict[str, Any]:
    memory_findings = memory.get("findings", [])
    baseline_findings = baseline.get("findings", [])
    validated = memory.get("retrieval", {}).get("validated_evidence", [])
    validated_ids = {item.get("decision_id") for item in validated}
    memory_citations = {
        decision_id
        for finding in memory_findings
        for decision_id in finding.get("evidence_ids", [])
    }
    baseline_citations = {
        decision_id
        for finding in baseline_findings
        for decision_id in finding.get("evidence_ids", [])
    }
    memory_team_findings = [
        finding for finding in memory_findings if finding.get("category") == "team_convention"
    ]
    baseline_team_findings = [
        finding for finding in baseline_findings if finding.get("category") == "team_convention"
    ]
    checks = {
        "same_candidate": memory.get("pr_id") == baseline.get("pr_id"),
        "same_model": (memory.get("provider"), memory.get("model"))
        == (baseline.get("provider"), baseline.get("model")),
        "memory_retrieved_validated_source": bool(validated),
        "memory_produced_grounded_team_finding": bool(memory_team_findings)
        and bool(memory_citations)
        and memory_citations.issubset(validated_ids),
        "baseline_has_no_memory_citations": not baseline_citations,
        "baseline_has_no_team_policy_finding": not baseline_team_findings,
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "counts": {
            "validated_memory_sources": len(validated),
            "memory_findings": len(memory_findings),
            "memory_team_findings": len(memory_team_findings),
            "memory_citations": len(memory_citations),
            "baseline_findings": len(baseline_findings),
            "baseline_team_findings": len(baseline_team_findings),
            "baseline_citations": len(baseline_citations),
        },
        "run_ids": {
            "memory": memory.get("run_id"),
            "baseline": baseline.get("run_id"),
        },
    }
