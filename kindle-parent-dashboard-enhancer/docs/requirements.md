# Kindle Parent Dashboard Enhancer Requirements

## Scope
- Target page: `https://parents.amazon.co.jp/settings/add-content?isChildSelected=true`
- Purpose: scan/add-content catalog into local DB, then operate Add/Remove from search results even when the card is not currently visible.

## UI Requirements
- Control buttons:
  - `Scan (Bulk)`: fast scan; ingest is done mainly at stop/end.
  - `Scan (Step)`: safe scan; ingest while scrolling.
  - `Stop`: stops current scan/bulk operation.
  - `Add All Hits`: sends Add (`ADDED`) request for all current search hits.
  - `Dump DB`: prints current DB and state to browser console.
  - `Clear DB`: clears both DB and state.
- Search area:
  - input box + `Hit: N`.
  - result rows show title + checkbox (Add/Remove).
  - title row is not a jump button (no auto-scroll-to-item on click).

## Scan and Ingest Requirements
- Infinite scroll is used to load more cards.
- DB ingest source is visible cards in DOM.
- Two scan modes:
  - `Scan (Bulk)`: prioritizes speed.
  - `Scan (Step)`: prioritizes capture robustness.
- On scan stop/end, ingest runs and DB/UI stats are refreshed.

## Search Requirements
- Search uses whitespace-split AND matching.
- Title comparison is normalized by:
  - space normalization (including full-width space).
  - full-width/half-width digit equivalence.
  - lowercasing.
- Result list is sorted by locale-aware title order (`ja`, numeric).
- UI rendering limit for results is first 200 items.

## Add/Remove Requirements
- Per-row checkbox sends target status explicitly:
  - checked => `ADDED`
  - unchecked => `NOT_ADDED`
- `Add All Hits` sends `ADDED` for all current hits in sorted order.
- API endpoint: `POST /ajax/update-add-content-status-batch`.
- Request needs:
  - ASIN
  - child directed id
  - CSRF token
  - content type (default `EBOOK` if unknown)
- If the target card is visible, switch visuals are synced after success.
- If not visible, request can still succeed but on-page switch cannot be visually synced immediately.

## ASIN Learning Requirements
- ASIN is learned from:
  - observed `/ajax/*` response JSON.
  - observed payloads to `/ajax/update-add-content-status-batch`.
  - pending clicked title when payload includes a single ASIN.
- Title->ASIN resolution order:
  - direct key/title map lookup
  - normalized-title unique match
  - DB fallback (`asin` on matching record)

## Persistence Requirements
- Local DB key: `kindle_parent_dashboard_enhancer_db`
- State key: `kindle_parent_dashboard_enhancer_state`
- DB record schema:
  - `key` (string)
  - `title` (string)
  - `asin` (optional string)
  - `seenAt` (number)
- Persisted state schema (minimal):
  - `titleToAsin: Record<string, string>`
  - `asinStatus: Record<string, "ADDED" | "NOT_ADDED">`
- Session-only (not persisted):
  - `csrfToken`
  - `childDirectedId`
  - `childDirectedIdCandidates`
  - `asinContentType`
- `Clear DB` must remove both DB key and state key.

## Failure/Status Requirements
- If ASIN is missing: show `Toggle: asin missing (scan first)` and do not send request.
- If child id is unknown: show `Toggle: child id unknown (toggle once on page first)` and do not send request.
- If CSRF is unknown: show `Toggle: csrf unknown` and do not send request.
- On API/network failures, show request error status and keep UI consistent (checkbox rollback on single-row operation).
