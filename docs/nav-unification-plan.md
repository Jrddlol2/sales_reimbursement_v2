# Navigation / Module Unification — Refactor Plan

> Status: **Phases 0–3 done; Phases 4–5 not started.** This document is the
> agreed plan of record from the nav/module audit. Do the phases in order; each
> phase must leave the app fully working before the next begins.

## Guiding constraints (from CLAUDE.md)

- **Screen-by-screen, not bulk find-and-replace.** Migrate one page/component at
  a time and verify before moving on.
- **Never break existing URLs.** Bookmarks, notification click-throughs, and
  dashboard quick-action links all target real routes. Old paths stay reachable
  (as wrappers or redirects) whenever a page moves.
- **This is still a prototype** on mock/in-memory data — frontend-only work. No
  backend/schema changes are implied by anything below.
- Lowest-risk → highest-risk ordering. The queue merge (Phase 5) is explicitly
  deferred and may be dropped entirely.

## Decisions locked in

- **R1 (unify "my submissions" list): keep both URLs.** `/history` and
  `/my-requests` both stay live as thin wrappers over a shared `RequestList`.
  No consolidation to a single `/requests` route — avoids relying on redirects
  for existing bookmarks and `?status=` / `?type=` deep-links.

---

## Phase 0 — Free cleanups (no behavior change)

Pure removal of superseded/dead code. Safe because the redirects already exist.

- [x] Remove the `/notifications` special-case in `ProtectedRoute`. The route
      already redirects to `/emails`, so the guard branch was dead. (Remaining
      comment steps renumbered.)
- [x] Keep the `/approvals` → `/` redirect — it protects real notification
      links — now labelled a compatibility shim, not a live route.

**Verify:** load as each role; confirm nav renders and a notification
click-through still resolves to `/emails`.

---

## Phase 1 — Extract shared presentational pieces (no route changes)

Enabling work. Nothing user-visible changes, so verification = "screens look
identical." Do each component separately, verify, then the next.

### `RequestTable`
- [x] Extracted the row renderer from `src/pages/TransactionHistory.tsx` into
      `src/components/RequestTable.tsx` (desktop table + mobile cards +
      `WorkflowOwnerTag`).
- [x] Added an optional `renderActions(item)` slot (stops row-click propagation)
      for callers that need per-row buttons; defaults to the chevron.
- [x] Migrated `TransactionHistory` onto it; verified in-browser (header, rows,
      owner tags, mobile cards, pagination, row navigation all intact).
- [x] `MyRequests` / `ApprovalQueue` table migrations deferred to their own
      phases (MyRequests still uses `RecentActivityTable` for its list).

### `MetricRow`
- [x] Wrapped the `metricsForRole()` → `MetricCard` grid + `metricActionMap`
      pattern into `src/components/dashboard/MetricRow.tsx`. Takes `metrics`
      (not `role`, for reuse by dashboards that pass filtered subsets), `ctx`,
      `actionMap`, `heading`, `subheading`, `className`. Reads the period
      context itself.
- [x] Migrated the Requestor dashboard block (`RequestorDashboard.tsx`) and the
      verbatim duplicate in `MyRequests.tsx`. Both verified in-browser.

**Verify:** ✅ dashboards and the two list pages render unchanged; `tsc --noEmit`
clean (only pre-existing `@playwright/test` errors remain); no console errors.

---

## Phase 2 — R1: unify the "my submissions" list (highest value)

`TransactionHistory` + `MyRequests` share `useUnifiedRequestList`, the same
table, and the same filters. Only real differences: scope (own vs. all) and
whether a KPI header shows.

- [x] Created `src/pages/RequestList.tsx` — `scope: 'own' | 'all'`, `showKpis`,
      `kpiBasePath`, `headerActions`, `listTitle`, `showRecordCount`,
      `exportFilename`. Built on the Phase 1 `RequestTable` + `MetricRow`.
      Status/type filters read from the URL so deep-links land pre-filtered.
- [x] Converted `/history` and `/my-requests` into **thin wrappers**. Both
      routes stay live.
- [x] Preserved role-scope: Custodian/Admin = `all`, everyone else (Requestor,
      Approver-own-history) = `own`; `/my-requests` is always `own`.
- [x] Old page bodies deleted (wrappers are ~20–40 lines each).

**Verify:** ✅ `/history?status=Rejected` lands filtered (dropdown = Rejected,
3 rows, all REJECTED); `/my-requests` KPIs + filters + table render for an
Approver; row navigation, CSV export, pagination intact; no console errors.

---

## Phase 3 — R3: split `Settings`

`src/pages/Settings.tsx` is one route rendering three identities via per-role
relabeling. Split it into real routes.

- [x] `/settings/delegation` (Approver) and `/settings/data` (Admin) routes
      added, both rendering `Settings` (which already branches on role).
- [x] Kept `/settings` as a role-resolving `SettingsRedirect` (Approver →
      delegation, Admin → data, else role home) so dashboard quick-actions
      pointing at `/settings` keep working.
- [x] Removed the per-role relabel logic in `Layout` and the `/settings`
      branch in `getBreadcrumb`; nav now has two distinct entries
      (Approval Delegation / Data Management). Dropped the now-unused `Gear`
      import.

**Verify:** ✅ Approver `/settings` → `/settings/delegation` (breadcrumb
"Approval Delegation", form renders); Admin `/settings` → `/settings/data`
(breadcrumb "Data Management"); nav shows the correct single entry per role.

---

## Phase 4 — nav config + `ProtectedRoute` simplification

Now that Settings is split and lists are unified:

- [ ] Collapse duplicate `navItems` entries — Ready to Claim currently has two
      rows (`Layout.tsx:14` PRIMARY, `Layout.tsx:28` MY REQUESTS) purely for the
      per-role group difference.
- [ ] Drop `ProtectedRoute`'s "a path can appear more than once" special-case
      (`src/App.tsx:97`) and the hardcoded `/claims/new` branch
      (`src/App.tsx:78`), once the duplicate entry is gone.
- [ ] Gating becomes a clean `roles.includes(user.role)` against one nav config.
      (Detail routes at `src/App.tsx:82` already model the target pattern.)

**Verify:** each role sees exactly its intended nav; direct-URL access to a
disallowed route still bounces to the role home page.

---

## Phase 5 — R2: merge the two queues (DEFERRED / optional)

`ApprovalQueue` (page + embedded in the Approver dashboard) + `ProcessingQueue`
→ one `WorkQueue` shell, role-gated actions.

- **Highest risk.** These are the most behavior-dense files: optimistic hides,
  release-code generation, bulk approve/reject, org-change transfers, review
  meetings.
- Treat as a **separate decision after Phases 0–4 land**, not part of the same
  push.
- May not be worth it: the shared `RequestTable` from Phase 1 likely already
  removes most of the visible duplication. Re-evaluate then.

---

## Redundancy reference (from the audit)

| ID | Today | Target | Phase |
|----|-------|--------|-------|
| R1 | `TransactionHistory` + `MyRequests` | `RequestList` (scope prop) | 2 |
| R2 | `ApprovalQueue` + `ProcessingQueue` | `WorkQueue` | 5 (deferred) |
| R3 | `Settings` relabeled 3 ways | `/settings/delegation` + `/settings/data` | 3 |
| R4 | 4 per-dashboard KPI blocks | `MetricRow` | 1 |
| R5 | `/notifications` alias, `/approvals` redirect | cleaned up | 0 |
| — | 3 ad-hoc request tables | `RequestTable` | 1 |

## Files most affected

- `src/App.tsx` — routing + `ProtectedRoute` (Phases 0, 2, 3, 4)
- `src/components/Layout.tsx` — `navItems`, relabel logic, breadcrumb (Phases 3, 4)
- `src/pages/TransactionHistory.tsx`, `src/pages/MyRequests.tsx` (Phases 1, 2)
- `src/pages/Settings.tsx` (Phase 3)
- `src/pages/ApprovalQueue.tsx`, `src/pages/ProcessingQueue.tsx` (Phase 5)
- New: `RequestTable`, `MetricRow`, `RequestList`, `WorkQueue`
