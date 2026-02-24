# Kindle Parent Dashboard Enhancer Requirements

## Goal
- On `parents.amazon.co.jp/settings/add-content`, allow bulk collection first, then Add/Remove from DB results.

## Functional Requirements
- The page can be auto-scrolled to load more cards.
- Users can build DB first (title-based seed), then operate on DB items later.
- DB items support Add/Remove action from the search list.
- Add/Remove uses `POST /ajax/update-add-content-status-batch` and requires ASIN.
- ASIN is learned from page runtime/network data (`/ajax/*`, update payloads).
- DB keeps title and ASIN; when ASIN is known, ASIN is preferred as identity.
- Add/Remove should work even when the target card is not currently visible on page.
- If target card is visible, switch UI should be visually synced after API success.

## Data Model (Current Policy)
- DB record fields:
  - `key`: title key (from aria-label prefix or visible title)
  - `title`: display title
  - `asin`: optional, filled when learned
  - `seenAt`: timestamp
- Runtime state fields:
  - `titleToAsin`
  - `asinStatus`
  - `asinContentType`
  - `childDirectedId`

## Behavior Rules
- If ASIN is unknown for an item, Add/Remove is not sent and status shows unknown.
- If childDirectedId is unknown, Add/Remove is not sent and status shows unknown.
- Search supports whitespace AND matching and full-width/half-width digit equivalence.

## Known Constraints
- Some cards may not have enough DOM info for direct ASIN extraction.
- Visual toggle sync is only possible when the card is in current DOM.
- For non-visible items, API action may succeed but on-page toggle cannot be visibly updated immediately.
