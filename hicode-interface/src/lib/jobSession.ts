/**
 * Which analysis run the UI is currently looking at.
 *
 * Analysis happens on /analysis but its output is also read by /results, so
 * the run has to survive a navigation. It is identified by job id alone —
 * the backend still holds the result and the dataset behind it, so there is
 * nothing to copy between pages.
 *
 * Two places remember it, deliberately:
 *   - the URL, so a run can be linked to and survives a reload
 *   - localStorage, so switching pages via the sidebar (no query string)
 *     still lands on the run you were just looking at
 *
 * The URL wins when both are present.
 */

const STORAGE_KEY = "hicode.currentJobId";
const QUERY_PARAM = "job";

/** Read the job id from the current URL, if the page was opened with one. */
export function readJobIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(QUERY_PARAM);
}

/** Persist the job id so other pages can pick it up. */
export function rememberJobId(jobId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, jobId);
  } catch {
    // Private browsing and blocked storage are survivable — the URL still
    // carries the id, so only cross-page navigation degrades.
  }
}

/** The job id this page should show: URL first, then whatever was last run. */
export function recallJobId(): string | null {
  const fromUrl = readJobIdFromUrl();
  if (fromUrl) return fromUrl;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Build a path carrying the job id, for links between the two pages. */
export function withJobId(path: string, jobId: string | null): string {
  return jobId ? `${path}?${QUERY_PARAM}=${encodeURIComponent(jobId)}` : path;
}

/**
 * Put the job id in the address bar without a navigation.
 *
 * replaceState rather than router.replace: this fires right after an analysis
 * completes, and a router navigation at that moment would re-run the page's
 * effects and re-fetch the result that is already in state.
 */
export function syncJobIdToUrl(jobId: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(QUERY_PARAM, jobId);
  window.history.replaceState(null, "", url.toString());
}
