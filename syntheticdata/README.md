# syntheticdata/

Despite the directory name, the CSV files here are **real patient review samples
scraped from Vitals / RateMDs / Yelp**, not synthetically generated text. They
are slices of the larger `0-RawDataStore/PhyReview*` corpus, kept in this repo
as fixtures for HICode dev work and as the datasets the UI offers.

`hicode-api/main.py` reads this directory as `DATA_DIR` and exposes every `.csv`
here as a selectable backend dataset, sorted by document count.

## Contents

| File | Rows | Schema | Notes |
|---|---|---|---|
| `doctor_reviews_100.csv` | 100 | `text_id` / `text` + 22 metadata columns | Default demo dataset. Stratified sample of `notebooks/doctor_review_sample1000.csv` — see below. |
| `physician_reviews.csv` | 20 | `id` / `review_text` + `rating`, `physician_specialty`, `date` | Deliberately kept: a completely different schema, so it exercises the data-agnostic column detection. |

The 10 / 20 / 50-row fixtures were removed in the 2026-07-28 round — they were
too small to show what the pipeline actually produces.

## Column detection

Two schemas coexist here (`id`/`review_text` and `text_id`/`text`). The backend
detects them rather than hardcoding names; see `detect_columns()` in
`hicode-api/main.py`. Adding a CSV with any of the recognised id/text column
names is enough to make it selectable — every other column is treated as
metadata and becomes available to the theme x metadata views.

## Regenerating the demo sample

```
python scripts/make_demo_sample.py
```

Deterministic given the same source and seed. Sampling is stratified across
`Gender` x `PhysicianType` x `platform` rather than random: a plain sample
leaves rare levels at single-digit counts, and the metadata panels then report
things like "100% male" for a theme backed by five documents.

The full 1000-row corpus stays in `notebooks/` rather than here — one pass over
it takes ~13 minutes and costs real API spend, so it is not something to expose
in a dropdown. It is the input for the efficiency work (see `plan/07-efficiency.md`).

## Handling

These reviews carry identifiable physician names, NPI numbers, practice ZIP
codes and patient narratives. The parent repository `KlausDi3/sanofi` is
**public**, and this directory has been published there since 2026-02-02.
That exposure was reviewed on 2026-08-14 and accepted by the project owner —
see `plan/DECISIONS.md` D-1. Treat any further redistribution as a decision to
raise with the study team rather than a routine one.
