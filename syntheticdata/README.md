# syntheticdata/

Despite the directory name, the CSV files here are **real patient review samples
scraped from Vitals / RateMDs / Yelp**, not synthetically generated text. They
are small slices of the larger `0-RawDataStore/PhyReview*` corpus, kept in this
repo as fixtures for HICode dev work.

Columns: `id`/`text_id`, `review_text`/`text`, `PhyID`, `platform`.

`hicode-api/main.py` reads this directory as `DATA_DIR` and exposes each `.csv`
here as a selectable backend dataset in the UI dropdown (sorted by document
count: 10 → 20 → 50 → 100 → 200 …).

Because reviews contain identifiable physician names and patient narratives,
**do not push this directory to a public repo.** The parent repository is
private; keep it that way.
