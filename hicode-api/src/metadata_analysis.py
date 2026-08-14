"""Metadata profiling and theme x metadata cross-tabulation.

Port of notebooks/metadata-incorporation.ipynb Steps 2-3.  Written against
plain dicts/lists rather than pandas so the API keeps its current dependency
set — pandas is a heavy wheel and this module only needs group-by and
quantiles, both of which are a few lines of stdlib.

Two entry points:

  infer_column_types(rows, ...)   -> which metadata columns are categorical,
                                     which are continuous, and which are
                                     unusable (and why)
  build_metadata_panels(...)      -> per-column payloads the frontend renders
                                     directly, one panel per sub-tab

The notebook's heuristic (`nunique <= 10` -> categorical, any other numeric
-> continuous) is kept, but tightened: it plotted ZIP codes as a continuous
distribution because the only guard was a substring check for "id".  See
_UNUSABLE_NAME for the columns that guard now catches.
"""

import re
from collections import Counter, defaultdict

# Notebook's threshold: <= this many distinct values means "categorical".
MAX_CATEGORICAL_UNIQUE = 10

# Text columns above MAX_CATEGORICAL_UNIQUE but below this stay usable as
# categories — state (40) and Credential (19) are real grouping variables, they
# just need the panel truncated to the largest few.  Above this a bar chart
# stops communicating anything.
MAX_HIGH_CARDINALITY = 50

# How many categories a high-cardinality panel keeps before folding the rest
# into an "Other" bucket.
TOP_CATEGORIES = 12

# Tokens that mark a numeric column as an identifier rather than a magnitude —
# a median ZIP code or a mean NPI is noise.  The notebook only substring-matched
# "id", which is why PracticeZip5 and BusinessZip5 became boxplots.
_UNUSABLE_TOKENS = frozenset({
    "id", "ids", "uuid", "guid", "key", "index", "idx",
    "npi", "zip", "zipcode", "postal", "fips",
})


def _tokenize(name: str) -> list[str]:
    """Split a column name into lowercase word tokens.

    Handles the three conventions present in the data at once, so
    PracticeZip5 -> [practice, zip, 5], PhyID -> [phy, id], and
    median_household_income -> [median, household, income].
    """
    spaced = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", name)
    spaced = re.sub(r"(?<=[A-Za-z])(?=[0-9])", " ", spaced)
    spaced = re.sub(r"[^A-Za-z0-9]+", " ", spaced)
    return [token.lower() for token in spaced.split() if token]

# Columns whose average value is longer than this are prose, not a category.
_FREE_TEXT_AVG_LEN = 80

# Below this many non-empty values a column can't support a meaningful split.
_MIN_NON_EMPTY = 5


def _is_blank(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _as_number(value):
    """Return value as float, or None if it isn't numeric."""
    if _is_blank(value):
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _percentile(sorted_values: list[float], fraction: float) -> float:
    """Linear-interpolated percentile, matching numpy's default method."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = fraction * (len(sorted_values) - 1)
    low = int(pos)
    high = min(low + 1, len(sorted_values) - 1)
    weight = pos - low
    return sorted_values[low] * (1 - weight) + sorted_values[high] * weight


def infer_column_types(
    rows: list[dict],
    exclude: tuple = (),
) -> dict:
    """Classify each metadata column as categorical, continuous, or unusable.

    `rows` is the raw dataset as a list of dicts (one per document).
    `exclude` names columns to skip outright — normally the id and text
    columns, which are handled by the pipeline rather than plotted.

    Returns {"categorical": [...], "continuous": [...], "highCardinality":
    [...], "excluded": [{"column": ..., "reason": ...}, ...]}.

    highCardinality columns are categorical too — they are split out so the UI
    can show the agreed <= 10-distinct set by default and keep state/Credential
    behind a "more columns" affordance rather than dropping them.  The excluded
    list carries reasons so a researcher can see *why* a column went missing.
    """
    if not rows:
        return {"categorical": [], "continuous": [], "highCardinality": [], "excluded": []}

    columns = list(rows[0].keys())
    categorical, continuous, high_cardinality, excluded = [], [], [], []

    # Signature -> first column with that signature, so duplicated columns
    # (the dataset ships num_reviews and parsed_review_count with identical
    # values) only produce one panel instead of two identical ones.
    seen_signatures: dict[tuple, str] = {}

    for column in columns:
        if column in exclude:
            continue

        values = [row.get(column) for row in rows]
        non_empty = [v for v in values if not _is_blank(v)]

        if len(non_empty) < _MIN_NON_EMPTY:
            excluded.append({"column": column, "reason": "mostly empty"})
            continue

        if _UNUSABLE_TOKENS.intersection(_tokenize(column)):
            excluded.append({"column": column, "reason": "identifier or postal code"})
            continue

        avg_len = sum(len(str(v)) for v in non_empty) / len(non_empty)
        if avg_len > _FREE_TEXT_AVG_LEN:
            excluded.append({"column": column, "reason": "free text"})
            continue

        distinct = {str(v).strip() for v in non_empty}
        if len(distinct) <= 1:
            excluded.append({"column": column, "reason": "constant"})
            continue

        # Compare on normalized values so num_reviews ("15.0") and
        # parsed_review_count ("15") are recognised as the same column and
        # only produce one panel.
        signature = tuple(
            "" if _is_blank(v)
            else (number if (number := _as_number(v)) is not None else str(v).strip())
            for v in values
        )
        if signature in seen_signatures:
            excluded.append({
                "column": column,
                "reason": f"duplicate of {seen_signatures[signature]}",
            })
            continue
        seen_signatures[signature] = column

        if len(distinct) <= MAX_CATEGORICAL_UNIQUE:
            categorical.append(column)
            continue

        numeric = [_as_number(v) for v in non_empty]
        if all(n is not None for n in numeric):
            continuous.append(column)
        elif len(distinct) <= MAX_HIGH_CARDINALITY:
            high_cardinality.append(column)
        else:
            excluded.append({
                "column": column,
                "reason": f"too many distinct values ({len(distinct)})",
            })

    return {
        "categorical": categorical,
        "continuous": continuous,
        "highCardinality": high_cardinality,
        "excluded": excluded,
    }


def _normalize_doc_id(doc_id: str) -> str:
    """Strip the `_0` segment suffix the pipeline appends before labelling.

    run_hicode_pipeline feeds documents in as `{doc_id}_0`, so theme keys can
    come back either way depending on whether label_generation kept the
    suffix.  Metadata is keyed by the bare id.
    """
    return re.sub(r"_\d+$", "", str(doc_id))


def _categorical_panel(column, pairs, high_cardinality=False) -> dict:
    """pairs: list of (theme, category_value) for documents that have both.

    High-cardinality columns keep only the TOP_CATEGORIES most frequent values
    and fold the tail into "Other", so a 40-state column still renders as a
    readable bar chart instead of 40 slivers.
    """
    themes = sorted({theme for theme, _ in pairs})
    all_categories = Counter(value for _, value in pairs)

    folded = 0
    if high_cardinality and len(all_categories) > TOP_CATEGORIES:
        kept = {value for value, _ in all_categories.most_common(TOP_CATEGORIES)}
        folded = len(all_categories) - len(kept)
        pairs = [(theme, value if value in kept else "Other") for theme, value in pairs]

    categories = sorted({value for _, value in pairs})

    by_theme = []
    for theme in themes:
        counts = Counter(value for t, value in pairs if t == theme)
        total = sum(counts.values())
        by_theme.append({
            "theme": theme,
            "n": total,
            "counts": {c: counts.get(c, 0) for c in categories},
            "pct": {
                c: round(counts.get(c, 0) / total, 4) if total else 0.0
                for c in categories
            },
        })

    by_category = []
    for category in categories:
        counts = Counter(theme for theme, value in pairs if value == category)
        total = sum(counts.values())
        by_category.append({
            "category": category,
            "n": total,
            "counts": {t: counts.get(t, 0) for t in themes},
            "pct": {
                t: round(counts.get(t, 0) / total, 4) if total else 0.0
                for t in themes
            },
        })

    return {
        "column": column,
        "type": "categorical",
        "highCardinality": high_cardinality,
        # Non-zero means the chart is showing a truncated view; the UI must say
        # so rather than letting "Other" read as a real category.
        "foldedCategories": folded,
        "themes": themes,
        "categories": categories,
        "byTheme": by_theme,
        "byCategory": by_category,
    }


def _continuous_panel(column, pairs) -> dict:
    """pairs: list of (theme, float) for documents that have both."""
    grouped: dict[str, list[float]] = defaultdict(list)
    for theme, value in pairs:
        grouped[theme].append(value)

    by_theme = []
    for theme in sorted(grouped):
        values = sorted(grouped[theme])
        q1 = _percentile(values, 0.25)
        q3 = _percentile(values, 0.75)
        iqr = q3 - q1
        low_fence, high_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        inliers = [v for v in values if low_fence <= v <= high_fence] or values
        by_theme.append({
            "theme": theme,
            "n": len(values),
            "min": inliers[0],
            "q1": round(q1, 4),
            "median": round(_percentile(values, 0.5), 4),
            "q3": round(q3, 4),
            "max": inliers[-1],
            "mean": round(sum(values) / len(values), 4),
            "outliers": [v for v in values if v < low_fence or v > high_fence],
        })

    return {
        "column": column,
        "type": "continuous",
        "themes": sorted(grouped),
        "byTheme": by_theme,
    }


def build_metadata_panels(
    doc_themes: dict[str, set],
    rows: list[dict],
    id_column: str,
    column_types: dict,
) -> list[dict]:
    """Join per-document themes onto the raw metadata and summarise each column.

    `doc_themes` maps document id -> set of theme names (a document with three
    themes contributes a row to each, matching the notebook's long-format
    theme_df).  Returns one panel per usable column, categorical first.
    """
    themes_by_id = {_normalize_doc_id(k): v for k, v in doc_themes.items()}

    panels = []
    for column, is_high in [
        *((c, False) for c in column_types.get("categorical", [])),
        *((c, True) for c in column_types.get("highCardinality", [])),
    ]:
        pairs = []
        for row in rows:
            doc_id = _normalize_doc_id(row.get(id_column, ""))
            value = row.get(column)
            if _is_blank(value):
                continue
            for theme in themes_by_id.get(doc_id, ()):
                pairs.append((theme, str(value).strip()))
        if pairs:
            panels.append(_categorical_panel(column, pairs, high_cardinality=is_high))

    for column in column_types.get("continuous", []):
        pairs = []
        for row in rows:
            doc_id = _normalize_doc_id(row.get(id_column, ""))
            value = _as_number(row.get(column))
            if value is None:
                continue
            for theme in themes_by_id.get(doc_id, ()):
                pairs.append((theme, value))
        if pairs:
            panels.append(_continuous_panel(column, pairs))

    return panels
