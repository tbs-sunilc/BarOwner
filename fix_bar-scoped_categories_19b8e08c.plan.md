---
name: Fix bar-scoped categories
overview: Make inventory categories truly bar-scoped in the UI by always resolving the active bar from the logged-in owner, and fix the Inventory page’s category display/filtering to use bar inventory categories (by id) instead of master catalogue category strings.
todos:
  - id: resolve-bar-from-token
    content: Update Inventory + Add pages to resolve active bar via getBarDetails() and persist via setActiveBarDetails().
    status: pending
  - id: fix-category-filtering
    content: Change Inventory filter to filter by barInventoryCategoryId and display bar category name in the table.
    status: pending
  - id: harden-login-barid
    content: "Optional: clear stale active bar id on login when response user.barId is missing/invalid; avoid default bar fallback when authenticated."
    status: pending
  - id: manual-verify-two-owners
    content: "Run manual verification: OwnerA vs OwnerB categories isolated; filter works; category display matches selection."
    status: pending
isProject: false
---

## Goal
Ensure each bar owner only sees their own inventory categories, adding a bottle assigns the correct category, and filtering works.

## What’s happening now (root causes)
- `src/app/(dashboard)/inventory/page.tsx` builds the dropdown from bar categories, but filters using `item.category` (master catalogue type), so filtering appears broken.
- The Inventory table displays `item.category` (master catalogue type), not the bar’s custom category name, so it can look like the bottle “saved into another category”.
- Inventory/Add pages rely on `getActiveBarId()` (`sessionStorage`/`NEXT_PUBLIC_ACTIVE_BAR_ID`). If an owner logs in and the bar id isn’t refreshed from token-based bar details, the UI can operate on a stale/default `barId`, making categories appear “global”.

## Approach
### 1) Make bar resolution token-driven (per owner)
- On dashboard pages that depend on `barId` (at minimum `[src/app/(dashboard)/inventory/page.tsx](src/app/(dashboard)/inventory/page.tsx)` and `[src/app/(dashboard)/inventory/add/page.tsx](src/app/(dashboard)/inventory/add/page.tsx)`), resolve the active bar like the Dashboard does:
  - Call `getBarDetails()` (already exists in `[src/lib/api-client.ts](src/lib/api-client.ts)` at `/api/v1/bars/details`).
  - On success, call `setActiveBarDetails(bar)` to persist the correct `barId` for this logged-in owner.
  - Use that `barId` for all category/inventory calls.
- Safety: if `/bars/details` fails with 401, redirect to `/login` (pattern already used in `[src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)`).

### 2) Fix Inventory category display and filtering (use bar category, not master category)
- Keep loading `barCategories` via `listInventoryCategories(barId)` (already done).
- Build a map `categoryId -> categoryName` from `barCategories`.
- Change the filter state to be based on **bar category id** (or a special “All”) instead of string names.
- Filter `items` by `item.barInventoryCategoryId`.
- Update the table “Category” column to show the bar category name (lookup via the map), and optionally show the master catalogue `item.category` as a smaller secondary label if you still want it.

### 3) Make “Add Bottle” category selection robust
- After the token-driven bar resolution (step 1), the Add page will call `listInventoryCategories(barId)` and `createInventoryCategory(barId, ...)` against the correct bar.
- Optional hardening: in `[src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx)` if `response.user.barId` is missing/invalid, call `clearActiveBarId()` before redirect so we never fall back to a stale/default bar id.

### 4) Verify with a repeatable manual test
- Log in as OwnerA, create category “A1”, add a bottle, confirm:
  - Inventory page shows category “A1” for that bottle.
  - Filter “A1” shows only those items.
- Sign out, log in as OwnerB, confirm you do **not** see “A1”. Create “B1” and verify similarly.

## Files likely changed
- `[src/app/(dashboard)/inventory/page.tsx](src/app/(dashboard)/inventory/page.tsx)` (filter + display)
- `[src/app/(dashboard)/inventory/add/page.tsx](src/app/(dashboard)/inventory/add/page.tsx)` (ensure bar resolution via `/bars/details` when needed)
- Optional: `[src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx)` (hardening around active bar storage)
- Optional: introduce a small shared helper/hook like `src/lib/use-active-bar.ts` to avoid duplicating the “fetch bar details + setActiveBarDetails” pattern.

## Notes / constraints
- Since you don’t have the backend project in this workspace, we can’t change DB scoping. This plan makes the frontend always use the correct bar id per owner and fixes the UI bugs that make categories look global or incorrect.
- If after these changes categories still leak between owners (with correct barId confirmed), then the backend endpoint `/api/v1/bars/{barId}/inventory/categories` is ignoring `barId` and will need a server-side fix.