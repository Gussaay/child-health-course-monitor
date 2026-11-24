# Dashboards from server-calculated KPIs ("option 2")

Status: **being prepared, switched off.** Nothing here changes what users see
until a dashboard is switched on (see *Switching on*), after its comparison
tests have been reviewed.

## Why

Today every dashboard downloads the records it summarises and calculates in
the browser:

| Dashboard | Downloads today | Read cost per visit (worst case) |
|---|---|---|
| Service coverage (main Dashboard) | slim copy of every facility (server copy), full list as fallback | 1 function call (fallback: ~7,000 reads) |
| Mentorship | every visit, IMNCI and EENC visit report, every facility | thousands of reads per user (public link: anonymous copy, in pages) |
| Facility history | every facility snapshot up to the latest date asked, plus facilities | grows without end: every past month is read again on every visit |
| Facility update | the full facility list | ~7,000 reads |
| Courses | every course and participant | thousands of reads |

Past months never change, yet they are downloaded and recalculated on every
visit.

## The design

1. **One calculation, two places.** Each dashboard's numbers are worked out
   by a plain JavaScript module in `src/dashboards/` (no React). The browser
   uses it on the fallback path; the server uses the *same file*, bundled into
   `functions/generated/dashboards.cjs`. A test rebuilds the bundle and fails
   if the committed copy is out of date, so the two can never drift apart.

2. **Server-side KPIs.** A callable, `dashboardKpis`, keeps slim copies of the
   collections on the server (the delta-read pattern already used by
   `facilityDashboardCopy` and `homeCopy`: only changed records are read, a
   `count()` catches deletes, a weekly full rebuild), calculates the numbers for
   the filters asked, and returns only the numbers.

3. **Frozen history.** Results for periods that have ended (past months) are
   calculated once and saved (`_dashboardResults`, admin-only). Only the
   current period is recalculated, from the records that changed. This is what
   removes "read the full list again for previous information".

4. **The browser keeps the last result** (IndexedDB) and shows it at once,
   then asks the server only whether anything changed.

## The two scenarios

### Scenario 1: stay inside the free quota, keep the numbers exact

- A dashboard visit costs one function call and **no database reads** from
  the browser.
- The server reads only records changed since its last refresh (plus a cheap
  `count()`), shared by every visitor; requests within a few minutes share one
  refresh.
- Exactness: deltas use the server timestamp every save sets; `count()`
  catches hard deletes; a weekly full rebuild corrects anything else. Each
  result says when its data was last refreshed ("as of").
- Frozen past months are recalculated only if a record dated in that month
  changes (for example a late upload), which the delta read sees.

### Scenario 2: the paid (Blaze) plan has a problem and functions stop

- Every dashboard keeps its current path as the fallback: if the function
  call fails (unavailable, permission, quota, billing), the page switches to
  reading the lists directly and calculating in the browser **with the same
  module**, so the numbers are identical, only slower and costlier.
- The page says so in one line ("Live calculation — the server summary is not
  available right now"), and tries the server again on the next visit.
- The last result saved on the device is shown first in both cases, so users
  see numbers immediately even while the fallback loads.

## Switching on

`src/dashboards/serverKpiSwitch.js` holds one switch per dashboard, all `false`.
Turning one on makes that dashboard ask the server first. Each is switched on
separately, after its comparison tests are reviewed.

## Order of work

1. Shared pieces: module folder, bundle + drift test, `dashboardKpis` callable,
   browser hook with cache and fallback, switches.
2. Facility history (largest saving: past months frozen).
3. Facility update dashboard.
4. Service coverage (main Dashboard).
5. Mentorship dashboard.
6. Courses dashboard.

Each step: move the dashboard's calculation into `src/dashboards/` unchanged,
have the page use it, add the server side, and add comparison tests that run
fixture data through the page's original path and the server path and require
identical results.
