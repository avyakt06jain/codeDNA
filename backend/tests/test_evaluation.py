from codedna_memory.evaluation import evaluate_comparison


def review(mode, *, findings, validated=None):
    return {
        "run_id": f"run-{mode}",
        "pr_id": "pr-120",
        "mode": mode,
        "provider": "test",
        "model": "same-model",
        "findings": findings,
        "retrieval": {"validated_evidence": validated or []},
    }


def test_memory_lab_accepts_grounded_difference():
    memory = review(
        "memory",
        findings=[{"category": "team_convention", "evidence_ids": ["DEC-0103"]}],
        validated=[{"decision_id": "DEC-0103"}],
    )
    baseline = review(
        "baseline", findings=[{"category": "general", "evidence_ids": []}]
    )
    result = evaluate_comparison(memory, baseline)
    assert result["passed"] is True
    assert result["counts"]["memory_citations"] == 1
    assert result["counts"]["baseline_citations"] == 0


def test_memory_lab_rejects_baseline_contamination():
    memory = review(
        "memory",
        findings=[{"category": "team_convention", "evidence_ids": ["DEC-0103"]}],
        validated=[{"decision_id": "DEC-0103"}],
    )
    baseline = review(
        "baseline",
        findings=[{"category": "team_convention", "evidence_ids": ["DEC-0103"]}],
    )
    result = evaluate_comparison(memory, baseline)
    assert result["passed"] is False
    assert result["checks"]["baseline_has_no_memory_citations"] is False
