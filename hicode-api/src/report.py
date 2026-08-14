"""Printable HTML report for a finished analysis run.

Researchers need something they can hand to a collaborator. JSON is the
natural export for the code side but is unreadable to everyone else, so the
same run is also offered as a document: HTML that the browser prints to PDF.

Built with string formatting rather than a template engine — Jinja2 is not a
dependency and adding one for a single report is not worth the install on the
deployment image. Every interpolated value goes through html.escape; theme
names and label text come from an LLM and review text comes from the public
web, so none of it can be trusted as markup.

Scope is deliberately the pipeline output only — themes, labels, prevalence,
co-occurrence — and not the metadata breakdown. That was the call in the
2026-07-28 meeting: get the existing results exportable first.
"""

from html import escape, unescape
from typing import Optional

# Reviews are long; a report that inlines all of them stops being skimmable.
MAX_REVIEWS_PER_THEME = 5
MAX_REVIEW_CHARS = 400

STYLES = """
:root { --ink: #1a1a1a; --muted: #666; --line: #ddd; --accent: #1e40af; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: var(--ink); line-height: 1.55; margin: 0;
  padding: 40px; max-width: 900px; margin-inline: auto;
}
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid var(--line); }
h3 { font-size: 14px; margin: 0 0 6px; }
.subtitle { color: var(--muted); font-size: 13px; margin: 0 0 4px; }
.question { font-size: 15px; font-style: italic; color: var(--accent); margin: 12px 0 0; }
.stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 0; }
.stat { border: 1px solid var(--line); border-radius: 6px; padding: 10px 16px; min-width: 120px; }
.stat .value { font-size: 20px; font-weight: 600; }
.stat .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.theme { border: 1px solid var(--line); border-radius: 6px; padding: 16px; margin-bottom: 14px; }
.labels { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0; }
.label { background: #f1f5f9; border-radius: 10px; padding: 2px 9px; font-size: 11px; }
.review { border-left: 3px solid var(--line); padding: 4px 0 4px 12px; margin: 8px 0; font-size: 12px; color: #333; }
.review .doc-id { color: var(--muted); font-size: 10px; display: block; }
table { border-collapse: collapse; width: 100%; font-size: 12px; }
th, td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }
th { background: #f8fafc; font-weight: 600; }
td.num, th.num { text-align: right; }
footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid var(--line);
         font-size: 11px; color: var(--muted); }
@media print {
  body { padding: 0; }
  h2 { break-after: avoid; }
  .theme, table { break-inside: avoid; }
  .no-print { display: none; }
}
"""

PRINT_HINT = """
<div class="no-print" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;
     padding:10px 14px;margin-bottom:24px;font-size:13px;">
  Use your browser's Print dialog and choose “Save as PDF” to keep a copy.
</div>
"""


def _stat(value, label: str) -> str:
    return (
        f'<div class="stat"><div class="value">{escape(str(value))}</div>'
        f'<div class="label">{escape(label)}</div></div>'
    )


def _themes_section(topics: list, documents_shown: bool = True) -> str:
    if not topics:
        return "<p>No themes were produced by this run.</p>"

    blocks = []
    for topic in topics:
        labels = "".join(
            f'<span class="label">{escape(str(label))}</span>'
            for label in topic.get("labels", [])
        )
        texts = topic.get("documentTexts") or {}
        reviews = ""
        if documents_shown and texts:
            items = list(texts.items())[:MAX_REVIEWS_PER_THEME]
            reviews = "".join(
                f'<div class="review"><span class="doc-id">{escape(str(doc_id))}</span>'
                f"{escape(_clip(text))}</div>"
                for doc_id, text in items
            )
            if len(texts) > MAX_REVIEWS_PER_THEME:
                reviews += (
                    f'<p style="font-size:11px;color:var(--muted);margin:6px 0 0;">'
                    f"…and {len(texts) - MAX_REVIEWS_PER_THEME} more</p>"
                )

        blocks.append(
            f'<div class="theme"><h3>{escape(str(topic.get("name", "Untitled")))}</h3>'
            f'<p class="subtitle">{topic.get("fileCount", 0)} documents · '
            f'{len(topic.get("labels", []))} labels</p>'
            f'<div class="labels">{labels}</div>{reviews}</div>'
        )
    return "".join(blocks)


def _clip(text: str) -> str:
    # Reviews were scraped from web pages without decoding, so some still carry
    # entities like &#39;. Escaping those as-is renders the entity literally;
    # decoding first and escaping after (callers always escape) shows the
    # apostrophe and keeps the output safe.
    text = unescape(text or "").strip()
    return text if len(text) <= MAX_REVIEW_CHARS else f"{text[:MAX_REVIEW_CHARS]}…"


def _prevalence_table(label_counts: dict, doc_counts: dict) -> str:
    themes = sorted(set(label_counts) | set(doc_counts), key=lambda t: -doc_counts.get(t, 0))
    if not themes:
        return ""
    rows = "".join(
        f"<tr><td>{escape(theme)}</td>"
        f'<td class="num">{doc_counts.get(theme, 0)}</td>'
        f'<td class="num">{label_counts.get(theme, 0)}</td></tr>'
        for theme in themes
    )
    return (
        "<h2>Theme prevalence</h2><table><thead><tr><th>Theme</th>"
        '<th class="num">Documents</th><th class="num">Labels</th>'
        f"</tr></thead><tbody>{rows}</tbody></table>"
    )


def _cooccurrence_table(themes: list, matrix: list) -> str:
    if not themes or not matrix or len(themes) < 2:
        return ""
    if not any(any(row) for row in matrix):
        return (
            "<h2>Theme co-occurrence</h2>"
            "<p style='font-size:12px;color:var(--muted);'>"
            "No document carried more than one theme.</p>"
        )

    header = "".join(f'<th class="num">{escape(t)}</th>' for t in themes)
    rows = ""
    for i, theme in enumerate(themes):
        cells = "".join(
            f'<td class="num">{matrix[i][j] if i != j else "—"}</td>'
            for j in range(len(themes))
        )
        rows += f"<tr><th>{escape(theme)}</th>{cells}</tr>"
    return (
        "<h2>Theme co-occurrence</h2>"
        "<p style='font-size:12px;color:var(--muted);margin-top:-4px;'>"
        "Documents carrying both themes.</p>"
        f"<table><thead><tr><th></th>{header}</tr></thead><tbody>{rows}</tbody></table>"
    )


def render_report_html(
    result: dict,
    generated_at: str,
    dataset_name: Optional[str] = None,
) -> str:
    """Render one analysis run as a self-contained, printable HTML document."""
    query = result.get("query")
    total_documents = result.get("totalDocuments", 0)
    filtered = result.get("filteredDocuments")

    stats = _stat(len(result.get("topics", [])), "Themes")
    stats += _stat(total_documents, "Documents")
    if filtered is not None and filtered != total_documents:
        stats += _stat(filtered, "Analysed after filtering")
    stats += _stat(result.get("totalLabels", 0), "Unique labels")

    source_line = f"Dataset: {escape(dataset_name)}<br>" if dataset_name else ""

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>HICODE analysis — {escape(str(result.get("id", "")))}</title>
<style>{STYLES}</style></head>
<body>
{PRINT_HINT}
<h1>HICODE Analysis Report</h1>
<p class="subtitle">{source_line}Run {escape(str(result.get("id", "")))} · generated {escape(generated_at)}</p>
{f'<p class="question">“{escape(query)}”</p>' if query else ""}
<div class="stats">{stats}</div>

<h2>Themes</h2>
{_themes_section(result.get("topics", []))}

{_prevalence_table(result.get("themeLabelCounts") or {}, result.get("themeDocCounts") or {})}

{_cooccurrence_table(result.get("themesOrdered") or [], result.get("coOccurrenceMatrix") or [])}

<footer>
Produced by HICODE — hierarchical inductive coding. Themes and labels are
LLM-generated and should be reviewed before being treated as findings.
</footer>
</body></html>"""
