import { TokenUsage } from "@/types/analysis";

/** 87822 -> "87.8k", 1234567 -> "1.23M". Exact counts belong in a tooltip. */
export function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/**
 * Dollar estimate, or null when a model in the run has no price on file.
 * Runs on gpt-4o-mini cost fractions of a cent, so below one cent the
 * figure keeps enough digits to be non-zero.
 */
export function formatCost(usd: number | null | undefined): string | null {
  if (usd == null) return null;
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** "87.8k tokens · ~$0.01", for inline summaries. */
export function describeUsage(usage: TokenUsage | null | undefined): string | null {
  if (!usage || !usage.totalTokens) return null;
  const cost = formatCost(usage.estimatedCostUsd);
  return `${formatTokens(usage.totalTokens)} tokens${cost ? ` · ~${cost}` : ""}`;
}

/** Sum over runs; cost is null if any run's cost is unknown. */
export function sumUsage(usages: (TokenUsage | null | undefined)[]): TokenUsage {
  const total: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    requests: 0,
    estimatedCostUsd: 0,
    stages: {},
  };
  for (const u of usages) {
    if (!u) continue;
    total.promptTokens += u.promptTokens;
    total.completionTokens += u.completionTokens;
    total.totalTokens += u.totalTokens;
    total.requests += u.requests;
    if (total.estimatedCostUsd !== null) {
      total.estimatedCostUsd =
        u.estimatedCostUsd == null ? null : total.estimatedCostUsd + u.estimatedCostUsd;
    }
  }
  return total;
}
