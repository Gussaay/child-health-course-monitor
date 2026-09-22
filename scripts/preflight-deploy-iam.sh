#!/usr/bin/env bash
#
# Fails the release early when the CI service account cannot deploy Cloud
# Functions.
#
# Why this exists: the functions deploy is step 7 of the pipeline, after a
# ~15 minute Android build and after the signed APK has already been uploaded
# to Storage. When it failed on a missing IAM permission the whole release was
# wasted, and the error surfaced as a 403 from the Cloud Functions API naming
# neither the permission nor the account.
#
# This asks Google which of the permissions a deploy needs the active
# credentials actually hold, and prints the exact grant commands for the ones
# they do not. It runs in seconds, before anything is built.
#
# Two rules keep the check from becoming a new way for the release to fail:
#
#   * If the check itself cannot run — the API is down, the account cannot
#     read the project — it warns and exits 0. The real deploy decides.
#   * Only permissions that EVERY deploy needs fail the run. The ones needed
#     just to create something for the first time (a function that does not
#     exist yet, the Artifact Registry repository, the public-invoker binding
#     on a new Cloud Run service) are reported as warnings, because a deploy
#     that only updates what is already there does not use them. They are
#     still printed here, so when the deploy does fail at step 7 the fix is
#     already in the same log.

set -uo pipefail

PROJECT="${1:-imnci-courses-monitor}"

# functions/index.js ships three v2 callables — Cloud Run services underneath
# — and one v1 Auth onCreate trigger, so both generations are in play: Cloud
# Functions and Cloud Run for the services, Cloud Build and Artifact Registry
# to build the container, Storage for the uploaded source, Service Usage
# because the CLI enables APIs as it goes.
#
# Each entry is "permission|role that grants it".

# Needed by every deploy, including one that only updates existing functions.
REQUIRED=(
  "cloudfunctions.functions.get|roles/cloudfunctions.admin"
  "cloudfunctions.functions.update|roles/cloudfunctions.admin"
  "cloudfunctions.operations.get|roles/cloudfunctions.admin"
  "run.services.get|roles/run.admin"
  "run.services.update|roles/run.admin"
  "cloudbuild.builds.create|roles/cloudbuild.builds.editor"
  "cloudbuild.builds.get|roles/cloudbuild.builds.editor"
  "storage.objects.create|roles/storage.admin"
  "storage.objects.get|roles/storage.admin"
  "serviceusage.services.use|roles/serviceusage.serviceUsageConsumer"
  "firebase.projects.get|roles/firebase.admin"
)

# Needed only when something is created rather than updated.
ADVISORY=(
  "cloudfunctions.functions.create|roles/cloudfunctions.admin"
  "run.services.create|roles/run.admin"
  "run.services.setIamPolicy|roles/run.admin"
  "artifactregistry.repositories.get|roles/artifactregistry.admin"
  "artifactregistry.repositories.create|roles/artifactregistry.admin"
  "storage.buckets.get|roles/storage.admin"
)

PERMS=""
for ENTRY in "${REQUIRED[@]}" "${ADVISORY[@]}"; do
  PERMS="${PERMS},${ENTRY%%|*}"
done
PERMS="${PERMS#,}"

ACCOUNT=$(gcloud config get-value account 2>/dev/null)
echo "Checking deploy permissions for ${ACCOUNT:-the active credentials} on ${PROJECT}"

HELD=$(gcloud projects test-iam-permissions "$PROJECT" \
  --permissions="$PERMS" \
  --format="value(permissions)" 2>/dev/null | tr ';' '\n' | tr -d ' ')

if [ -z "$HELD" ]; then
  echo "::warning::Could not read the permissions of ${ACCOUNT:-the active credentials} on ${PROJECT}."
  echo "Skipping the preflight check — the deploy itself will report the real error."
  exit 0
fi

MISSING_ROLES=""
FAILED=0

add_role() {
  case "$MISSING_ROLES" in
    *" $1 "*) ;;
    *) MISSING_ROLES="${MISSING_ROLES} $1 " ;;
  esac
}

for ENTRY in "${REQUIRED[@]}"; do
  PERM="${ENTRY%%|*}"
  ROLE="${ENTRY##*|}"
  if ! echo "$HELD" | grep -qx "$PERM"; then
    echo "  MISSING  ${PERM}  (${ROLE})"
    FAILED=1
    add_role "$ROLE"
  fi
done

ADVISORY_MISSING=0
for ENTRY in "${ADVISORY[@]}"; do
  PERM="${ENTRY%%|*}"
  ROLE="${ENTRY##*|}"
  if ! echo "$HELD" | grep -qx "$PERM"; then
    echo "  missing, needed only to create  ${PERM}  (${ROLE})"
    ADVISORY_MISSING=1
    add_role "$ROLE"
  fi
done

# Deploying a function means running it as a service account, which requires
# iam.serviceAccounts.actAs on that account specifically. No project-level
# role implies it, and this is what a Firebase functions deploy most often
# trips over. The appspot account runs both generations here; the compute
# account is the v2 default, so treat it as advisory.
APPSPOT_SA="${PROJECT}@appspot.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)" 2>/dev/null)
COMPUTE_SA=""
if [ -n "$PROJECT_NUMBER" ]; then
  COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

# firebase-tools 14 runs v2 functions as the compute default service account,
# and that account only exists once the Compute Engine API has been enabled on
# the project. On a Firebase project that has never used Compute Engine it is
# simply absent, and deploying a NEW v2 function then fails with
# "Default service account ... doesn't exist" — which reads like a permission
# problem and is not one. Nothing about the account's IAM policy can fix it;
# the API has to be enabled first.
if [ -n "$COMPUTE_SA" ]; then
  SA_ERR=$(gcloud iam service-accounts describe "$COMPUTE_SA" --format="value(email)" 2>&1 >/dev/null)
  if [ $? -ne 0 ]; then
    case "$SA_ERR" in
      *NOT_FOUND*|*"not found"*|*"does not exist"*)
        echo "  MISSING  the v2 runtime service account ${COMPUTE_SA} does not exist"
        echo ""
        echo "::error::${COMPUTE_SA} does not exist, so a new v2 function cannot be created. Enable the Compute Engine API on ${PROJECT} — that is what provisions it."
        echo ""
        echo "gcloud services enable compute.googleapis.com --project=${PROJECT}"
        echo ""
        exit 1
        ;;
      *)
        echo "::warning::Could not check whether ${COMPUTE_SA} exists."
        ;;
    esac
  fi
fi

MISSING_ACTAS=""
for SA in $APPSPOT_SA $COMPUTE_SA; do
  ACTAS=$(gcloud iam service-accounts test-iam-permissions "$SA" \
    --permissions=iam.serviceAccounts.actAs \
    --format="value(permissions)" 2>/dev/null)
  RC=$?
  # A non-zero exit means the question could not be asked — the account does
  # not exist on this project, or the API refused the call. That is not the
  # same as "the permission is missing", so it must not fail the release.
  if [ "$RC" -ne 0 ]; then
    echo "::warning::Could not check iam.serviceAccounts.actAs on ${SA}."
    continue
  fi
  if [ -n "$ACTAS" ]; then
    continue
  fi
  MISSING_ACTAS="${MISSING_ACTAS} ${SA}"
  if [ "$SA" = "$APPSPOT_SA" ]; then
    echo "  MISSING  iam.serviceAccounts.actAs on ${SA}"
    FAILED=1
  else
    echo "  missing, needed only for v2 defaults  iam.serviceAccounts.actAs on ${SA}"
    ADVISORY_MISSING=1
  fi
done

if [ "$FAILED" -eq 0 ] && [ "$ADVISORY_MISSING" -eq 0 ]; then
  echo "All permissions required for the Cloud Functions deploy are present."
  exit 0
fi

MEMBER="serviceAccount:${ACCOUNT}"
print_fix() {
  echo ""
  echo "Run these in Cloud Shell (https://console.cloud.google.com/?cloudshell=true)"
  echo "as a project owner, then re-run this workflow:"
  echo ""
  for ROLE in $MISSING_ROLES; do
    echo "gcloud projects add-iam-policy-binding ${PROJECT} \\"
    echo "  --member=\"${MEMBER}\" \\"
    echo "  --role=\"${ROLE}\""
  done
  for SA in $MISSING_ACTAS; do
    echo "gcloud iam service-accounts add-iam-policy-binding ${SA} \\"
    echo "  --member=\"${MEMBER}\" \\"
    echo "  --role=\"roles/iam.serviceAccountUser\""
  done
  echo ""
}

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "::error::${ACCOUNT:-The CI service account} cannot deploy Cloud Functions to ${PROJECT}. Grant the roles below and re-run this workflow."
  print_fix
  exit 1
fi

echo ""
echo "::warning::${ACCOUNT:-The CI service account} can update the existing Cloud Functions but may not be able to create new ones. Letting the deploy continue."
print_fix
exit 0
