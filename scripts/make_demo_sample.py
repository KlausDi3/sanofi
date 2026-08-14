"""Build the demo dataset the UI offers, by stratified sampling.

The 1000-review corpus is too slow and too expensive to run interactively
(13 minutes and real API spend for one pass), so the platform ships a 100-row
sample instead — the compromise agreed in the 2026-07-28 meeting.

Sampling is stratified rather than random on purpose.  A plain sample(100)
leaves the smaller levels with single-digit counts, and the metadata panels
then show things like "100% male" for a theme backed by five documents.
Strata are Gender x PhysicianType x platform, the three columns the metadata
views actually split by.

Deterministic: same input plus same seed gives the same output, so the demo
dataset can be regenerated and diffed rather than being an opaque artifact.

Usage:
    python scripts/make_demo_sample.py [--size 100] [--seed 20260728]
"""

import argparse
import csv
import math
import random
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "notebooks" / "doctor_review_sample1000.csv"
DESTINATION = REPO_ROOT / "syntheticdata" / "doctor_reviews_100.csv"

# The columns the metadata views group by; keeping their proportions intact is
# the whole point of stratifying.
STRATA_COLUMNS = ("Gender", "PhysicianType", "platform")

TEXT_COLUMN = "text"


def allocate(strata: dict, size: int) -> dict:
    """Split `size` across strata proportionally, giving every stratum at least one.

    Largest-remainder apportionment: floor the proportional shares, then hand
    out what's left to whoever was rounded down hardest.  The floor of 1 is
    what keeps rare combinations (Super Specialties on RateMD) present at all.
    """
    total = sum(len(rows) for rows in strata.values())
    exact = {key: size * len(rows) / total for key, rows in strata.items()}

    alloc = {
        key: min(len(strata[key]), max(1, math.floor(value)))
        for key, value in exact.items()
    }

    # Give away the remainder to the largest fractional parts.
    while sum(alloc.values()) < size:
        candidates = [k for k in alloc if alloc[k] < len(strata[k])]
        if not candidates:
            break
        key = max(candidates, key=lambda k: exact[k] - alloc[k])
        alloc[key] += 1

    # Over-allocated by the floor-of-1 rule: take back from the strata whose
    # share is most inflated relative to what they were owed.
    while sum(alloc.values()) > size:
        candidates = [k for k in alloc if alloc[k] > 1]
        if not candidates:
            break
        key = max(candidates, key=lambda k: alloc[k] - exact[k])
        alloc[key] -= 1

    return alloc


def report(name: str, rows: list, source_rows: list) -> None:
    """Print each stratum column's distribution beside the source's."""
    print(f"\n{name} (n={len(rows)})")
    for column in STRATA_COLUMNS:
        sample_counts = Counter(r[column] for r in rows)
        source_counts = Counter(r[column] for r in source_rows)
        print(f"  {column}")
        for value, count in source_counts.most_common():
            got = sample_counts.get(value, 0)
            print(
                f"    {value:<18} {got:>3}  ({got / len(rows):>5.1%})"
                f"   source {count / len(source_rows):>5.1%}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260728)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--destination", type=Path, default=DESTINATION)
    args = parser.parse_args()

    with open(args.source, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames
        source_rows = [row for row in reader if row.get(TEXT_COLUMN, "").strip()]

    missing = [c for c in STRATA_COLUMNS if c not in (fieldnames or [])]
    if missing:
        raise SystemExit(f"Source is missing stratum columns: {missing}")

    strata = defaultdict(list)
    for row in source_rows:
        strata[tuple(row[c] for c in STRATA_COLUMNS)].append(row)

    allocation = allocate(strata, args.size)

    rng = random.Random(args.seed)
    sampled = []
    for key in sorted(strata):
        # Sort before sampling so the result depends only on the seed, not on
        # the order rows happened to appear in the source file.
        pool = sorted(strata[key], key=lambda r: r["text_id"])
        sampled.extend(rng.sample(pool, allocation[key]))

    sampled.sort(key=lambda r: r["text_id"])

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    with open(args.destination, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sampled)

    print(f"Wrote {len(sampled)} rows to {args.destination.relative_to(REPO_ROOT)}")
    print(f"Strata: {len(strata)} non-empty, smallest allocation "
          f"{min(allocation.values())}, largest {max(allocation.values())}")
    report("Sample vs source", sampled, source_rows)


if __name__ == "__main__":
    main()
