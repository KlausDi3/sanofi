"""Token accounting for one pipeline run.

Every OpenAI response carries a `usage` block; before this the pipeline read
the content and dropped the rest. A run over 50 documents makes 50 label calls,
a few clustering calls and one embedding call, and nobody could say afterwards
what it had cost. The tracker adds each response up by stage and turns the
totals into a dollar estimate the UI can show.
"""

from __future__ import annotations

from threading import Lock
from typing import Callable, Optional


# USD per 1M tokens: (input, output). Hand-maintained; OpenAI changes these
# a few times a year, so a model missing here yields tokens with no cost
# rather than a wrong number. Snapshot: September 2026.
PRICES_PER_1M: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-5": (1.25, 10.00),
    "gpt-5-mini": (0.25, 2.00),
    "gpt-5-nano": (0.05, 0.40),
    "o3": (2.00, 8.00),
    "o4-mini": (1.10, 4.40),
    "text-embedding-3-small": (0.02, 0.0),
    "text-embedding-3-large": (0.13, 0.0),
}


def _price_for(model: str) -> Optional[tuple[float, float]]:
    """Look a model up, tolerating dated snapshots like gpt-4o-mini-2024-07-18."""
    if model in PRICES_PER_1M:
        return PRICES_PER_1M[model]
    # Longest prefix wins so "gpt-4o-mini-..." matches gpt-4o-mini, not gpt-4o.
    for name in sorted(PRICES_PER_1M, key=len, reverse=True):
        if model.startswith(name):
            return PRICES_PER_1M[name]
    return None


def estimate_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> Optional[float]:
    price = _price_for(model)
    if price is None:
        return None
    in_price, out_price = price
    return (prompt_tokens * in_price + completion_tokens * out_price) / 1_000_000


class UsageTracker:
    """Accumulates token usage per pipeline stage.

    `on_update` fires after every add so a job record can mirror the running
    total while generation is still going; the analysis page polls that.
    """

    STAGES = ("embedding", "generation", "clustering")

    def __init__(self, on_update: Optional[Callable[[dict], None]] = None):
        self._lock = Lock()
        self._stages: dict[str, dict] = {}
        self._on_update = on_update

    def add(self, stage: str, model: str, usage) -> None:
        """Record one response. `usage` is the SDK's usage object or None."""
        if usage is None:
            return
        prompt = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion = int(getattr(usage, "completion_tokens", 0) or 0)
        with self._lock:
            entry = self._stages.setdefault(stage, {
                "model": model,
                "requests": 0,
                "promptTokens": 0,
                "completionTokens": 0,
            })
            entry["requests"] += 1
            entry["promptTokens"] += prompt
            entry["completionTokens"] += completion
            snapshot = self._to_dict_locked()
        if self._on_update:
            self._on_update(snapshot)

    def to_dict(self) -> dict:
        with self._lock:
            return self._to_dict_locked()

    def _to_dict_locked(self) -> dict:
        stages = {}
        total_prompt = total_completion = total_requests = 0
        total_cost: Optional[float] = 0.0
        for name in self.STAGES:
            entry = self._stages.get(name)
            if not entry:
                continue
            cost = estimate_cost_usd(entry["model"], entry["promptTokens"], entry["completionTokens"])
            stages[name] = {
                **entry,
                "totalTokens": entry["promptTokens"] + entry["completionTokens"],
                "estimatedCostUsd": cost,
            }
            total_prompt += entry["promptTokens"]
            total_completion += entry["completionTokens"]
            total_requests += entry["requests"]
            # One unpriced stage makes the whole estimate unknown; a partial
            # dollar figure would read as the full price.
            if total_cost is not None:
                total_cost = None if cost is None else total_cost + cost
        return {
            "promptTokens": total_prompt,
            "completionTokens": total_completion,
            "totalTokens": total_prompt + total_completion,
            "requests": total_requests,
            "estimatedCostUsd": total_cost,
            "stages": stages,
        }


class _FakeUsage:
    def __init__(self, prompt_tokens: int, completion_tokens: int):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens


def mock_usage(documents: dict[str, str], gen_result: dict, model: str = "gpt-4o-mini") -> dict:
    """Plausible usage for mock mode, sized from the text actually served.

    Mock runs never touch OpenAI, so there is nothing real to report -- but the
    UI still needs numbers to lay out against. Four characters per token, plus
    a fixed prompt overhead per call, lands within a factor of two of what the
    real pipeline spends on the same fixtures.
    """
    tracker = UsageTracker()
    system_prompt_tokens = 350
    for text in documents.values():
        doc_tokens = max(1, len(text) // 4)
        tracker.add("generation", model, _FakeUsage(system_prompt_tokens + doc_tokens, 40))
    labels = sum(
        len(a.get("label", []))
        for doc in gen_result.values()
        for a in doc.get("LLM_Annotation", [])
    )
    batches = max(1, -(-labels // 100))
    for _ in range(batches):
        tracker.add("clustering", model, _FakeUsage(600 + 100 * 12, 900))
    tracker.add("embedding", "text-embedding-3-small",
                _FakeUsage(sum(len(t) // 4 for t in documents.values()), 0))
    return tracker.to_dict()
