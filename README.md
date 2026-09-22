# NCHP Monitoring

Monitoring system for Sudan's National Child Health Program: courses and
participants, health-facility records, skills mentorship visits, service
coverage dashboards and certificates.

It runs as three builds of the same React codebase:

| Build | How it ships | Update mechanism |
| --- | --- | --- |
| Web (PWA) | Firebase Hosting | Service worker, with a "Restart and install" prompt |
| Android | APK in Firebase Storage | Capgo OTA for web assets, a new APK for native changes |
| Desktop | Electron | electron-updater |

The app is offline-first. Health workers use it on connections that frequently
have a signal but no working internet, so almost every design decision in
`src/firebase.js` and `src/DataContext.jsx` follows from that.

---

## Running it locally

```bash
npm ci          # not npm install — the lockfile is what CI builds from
npm run dev     # http://localhost:5173
```

Other commands:

```bash
npm run lint        # ESLint; errors block CI, warnings are pre-existing debt
npm test            # Vitest unit tests
npm run build       # production build into dist/
npm run test:rules  # Firestore rules tests (needs the Firebase emulator)
```

Desktop and mobile:

```bash
npm run electron:start      # Electron against the dev server
npm run mobile:sync         # build + npx cap sync android
npm run mobile:android      # run on a connected device
```

There is no `.env` to fill in for normal development — the Firebase config is in
`src/firebase.js`, and the app version comes from `package.json` via
`vite.config.js`. Copy `.env.example` to `.env` only if you need to override it.

---

## How a release happens

Pushing to `main` runs `.github/workflows/deploy.yml`, which:

1. **Verifies** — lint, unit tests, and the Firestore rules tests against the
   emulator. A failure here stops the deploy.
2. **Checks that it can deploy at all** — `scripts/preflight-deploy-iam.sh`
   asks Google whether the CI service account holds the permissions the Cloud
   Functions deploy needs, before anything is built. See below.
3. Derives a version from the run number and writes it into `package.json`.
4. Builds the web assets and zips them as a Capgo OTA bundle, with a checksum.
5. Builds and signs the Android APK, then verifies the signature.
6. Uploads the APK to Firebase Storage and writes `native-version.json`.
7. Deploys Cloud Functions (not the security rules — see below).
8. Deploys the web app to Firebase Hosting (`live`).
9. Polls until `update.json` is actually live before telling devices about it.
10. Records the release in Firestore via `scripts/push-update.js`.

Pull requests run `.github/workflows/preview.yml`: the same checks, plus a
first-load payload budget and a deployed preview URL that expires after 7 days.

A commit message containing `[force-update]` marks the APK as mandatory.

### Secrets the workflow needs

| Secret | Used for |
| --- | --- |
| `KEYSTORE_BASE64` | The Android release keystore, base64-encoded |
| `KEY_ALIAS`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD` | Signing the APK |
| `FIREBASE_SERVICE_ACCOUNT_IMNCI_COURSES_MONITOR` | Hosting deploy, Storage upload, Firestore writes |

**Never commit the keystore or a service-account key.** Both were committed to
this repository in the past; `.gitignore` now covers them.

### When the Cloud Functions deploy fails on permissions

`functions/index.js` ships three v2 callables — which are Cloud Run services
underneath — and one v1 Auth `onCreate` trigger. Deploying that mix touches
more of Google Cloud than Firebase Hosting does: Cloud Functions, Cloud Run,
Cloud Build, Artifact Registry, Storage for the uploaded source, and Service
Usage because the CLI enables APIs as it goes.

The service account behind `FIREBASE_SERVICE_ACCOUNT_IMNCI_COURSES_MONITOR`
needs all of it. When a role is missing the CLI returns a bare 403 that names
neither the permission nor the account, and — because the functions step used
to run after the Android build — it cost a full release to find out.

The preflight step now reports exactly what is missing in the first minute of
the run, and prints the `gcloud` commands that fix it. Run them in
[Cloud Shell](https://console.cloud.google.com/?cloudshell=true) as a project
owner, then re-run the workflow.

It fails the run only on permissions that *every* deploy needs. The ones used
just to create something for the first time — a function that does not exist
yet, the Artifact Registry repository, the public-invoker binding on a new
Cloud Run service — are printed as warnings and the deploy continues, because
a release that only updates existing functions never uses them. The roles it
checks for:

| Role | Why |
| --- | --- |
| `roles/cloudfunctions.admin` | Create and update the functions themselves |
| `roles/run.admin` | The v2 callables are Cloud Run services |
| `roles/cloudbuild.builds.editor` | Building the function container |
| `roles/artifactregistry.admin` | Storing that container |
| `roles/storage.admin` | Uploading the function source, and the APK |
| `roles/serviceusage.serviceUsageConsumer` | Enabling the APIs the deploy uses |
| `roles/firebase.admin` | Reading the project through the Firebase API |
| `roles/iam.serviceAccountUser` | **On the runtime service accounts**, not on the project |

That last one is the one people miss. A function runs *as* a service account —
`imnci-courses-monitor@appspot.gserviceaccount.com`, and the project's
`*-compute@developer.gserviceaccount.com` for v2 — and deploying it requires
`iam.serviceAccounts.actAs` on that account specifically. No project-level role
implies it; the binding goes on the service account itself:

```bash
gcloud iam service-accounts add-iam-policy-binding imnci-courses-monitor@appspot.gserviceaccount.com --member="serviceAccount:<the CI service account>" --role="roles/iam.serviceAccountUser"
```

The preflight never fails the release on its own uncertainty. If it cannot
read the policy — the API is down, the account cannot see the project — it
warns and lets the deploy report the real error.

### The Compute Engine API has to be on

`firebase-tools` 14 runs v2 functions as the project's *compute* default
service account, `928082473485-compute@developer.gserviceaccount.com`. That
account is created when the Compute Engine API is first enabled — and on this
project it never was. `firebase deploy --debug` says so plainly:

```
unable to look up default compute service account.
Falling back to 928082473485-compute@developer.gserviceaccount.com
```

Creating a new v2 function then fails with *"Default service account ...
doesn't exist"*, which reads like a permission problem and is not one. No IAM
grant fixes it; the API has to be enabled, which is what provisions the
account:

```bash
gcloud services enable compute.googleapis.com --project=imnci-courses-monitor
```

`listUsers` and `sendFCMNotification` predate this and were deployed under the
App Engine default account, so they update fine — which is why the problem
only shows up when a *new* function is added. The preflight now checks that
the account exists.

---

## Security model

Authorization is enforced in **Firestore rules** (`firestore.rules`) and in
**Cloud Functions** (`functions/index.js`). The React app's permission checks
decide what to *show*; they are not a security boundary and must never be the
only check.

- A user's roles and permissions live on `users/{uid}`.
- The client can never write `role`, `roles`, `permissions`, `assignedState`,
  `assignedLocality`, `access` or `isAdmin` on its own profile — the rules
  reject it. Managers can still administer other people exactly as before.
- New profiles are created by the `createUserProfile` Auth trigger.
- Roles are changed by the `setUserRoles` callable function, which requires the
  caller to hold `super_user`, `federal_manager` or `states_manager` — the same
  set as `isManager()` in the rules. There is no `manager` role.

Permission names and the role presets are defined in
`src/components/permissions.js`, which is covered by `tests/permissions.test.js`.

### Deploy order — this matters

A release deploys **Cloud Functions first, then the web app**, then the APK
manifest that tells devices a new version exists. The workflow does that.

The browser no longer creates its own `users/{uid}` document — the
`createUserProfile` Auth trigger does. A web release that reached users before
the functions did would leave every new sign-up without a profile, so the
functions step runs first and a failure there stops the release.

**Security rules are not deployed by the workflow.** A rules mistake takes the
whole app down for everyone at once, and it shows up as "this screen is empty"
rather than as an error anyone can act on. They go out deliberately:

```bash
npm run test:rules     # 34 tests against the Firestore emulator
npm run deploy:rules
```

### Changing the rules

`firestore.rules` is the live ruleset. Treat it that way: start from what is
deployed and change one thing at a time.

A previous version of this file was written from scratch by reading `data.js`
for collection names. It passed its own tests and would still have broken
production, because it silently omitted `course_sub_types` and closed public
paths the app depends on — participant registration, public course reports,
online exercises, the facility forms. The tests in `tests/rules/` now assert
those public flows explicitly, so the same mistake fails CI.

If a screen breaks after a rules deploy: **Firebase console → Firestore →
Rules → version history** and roll back. It takes effect in seconds.

Roles, for reference: `super_user`, `federal_manager`, `states_manager`,
`locality_manager`, `federal_coordinator`, `state_coordinator`,
`course_coordinator`, `facilitator`, `user`. `isManager()` in the rules means
the first three.

---

## Layout

```
src/
  App.jsx              Shell, navigation, role loading. Views are lazy-loaded.
  firebase.js          Firebase init, real connectivity detection, cache-first reads
  data.js              Every Firestore read and write in the app
  DataContext.jsx      In-memory cache with delta sync and a 1-hour TTL
  i18n.js              Arabic/English catalogue and the RTL typography guard
  components/
    dialogs.jsx        notify() / confirmDialog() / promptDialog()
    ErrorBoundary.jsx  Stops one broken screen blanking the app
    CommonComponents.jsx  Shared Card/Button/Input/Table/Modal
    chartSetup.js      Chart.js registration — import it where charts render
    permissions.js     Roles, permission keys, merge logic
    mentorship/        Skills mentorship: assessments, visit reports, dashboards
    EmONC/             Maternal and neonatal emergency monitoring
functions/             Cloud Functions (notifications, user listing, roles)
public/geo/            Sudan GeoJSON, fetched at runtime rather than bundled
tests/                 Vitest unit tests
```

### Things worth knowing before changing them

- **`navigator.onLine` is not used anywhere, on purpose.** It reports that a
  network exists, not that it reaches anything. Use `isOnline()` from
  `src/firebase.js`, which probes real endpoints.
- **Never call `alert()`, `confirm()` or `prompt()`.** ESLint blocks them. Use
  `notify()`, `confirmDialog()` and `promptDialog()` from `components/dialogs`.
- **Import `chartSetup` where you render a chart.** Registering Chart.js from an
  eagerly-imported module pulls 190 KB into the first page load.
- **Keep the GeoJSON out of the bundle.** `public/geo/` is fetched at runtime.
- **Facility documents use Arabic field names** (`الولاية`, `اسم_المؤسسة`)
  alongside English ones (`project_name`, `lastSnapshotAt`). This is historical;
  don't add more of either without a reason.
