# Rapid facility report (Feb–Mar 2025) applied to the app

## What gets written
- **287 status changes**, sent as pending submissions in Child Health Services, the same way a field update is. Each one is the facility as it is now with only "functioning" changed. They wait for approval.
- Left out: 550 facilities updated in 2026, 47 the report lists twice with different statuses, and 8 whose locality in the report differs from the app.
- **873 new facilities** (Central Darfur 215, East Darfur 147, West Darfur 253, South Kordofan 258), added directly with IMNCI service set to `Unknown`.

## Coverage change (app code, local only)
Facilities with IMNCI `Unknown` are left out of every coverage calculation: the service coverage dashboard (IMNCI, ORT, tools, ETAT, EENC, SCNU), the home page coverage card, the bulk-update KPIs, and course report coverage before/after. Files are in `app-changes/files/` (and as `app-changes/coverage-unknown.patch`). Tests pass (349).

## How to run
From `C:\Users\Lenovo\imci-app`:

```
node facility-update-2025\apply-rapid-report.cjs --key service-account-key.json            (dry run, writes nothing)
node facility-update-2025\apply-rapid-report.cjs --key service-account-key.json --commit   (writes)
node facility-update-2025\apply-rapid-report.cjs --key service-account-key.json --undo     (removes everything it wrote, except submissions already approved or rejected)
```

The script checks each facility again before writing. It skips any facility whose status changed after the export or that was updated in 2026. It also skips any new facility that already exists with the same state, locality and name.
