# Deploying the DCPL backend to GCP (Cloud Run)

The backend runs as a container on **Cloud Run** in the same GCP project as
Firestore/Auth/Storage (`dcpl-interiors`). Because compute and data live in the
same project, the service authenticates to Firebase via the attached service
account (Application Default Credentials) — no `service-account.json` is shipped.

Set once:

```bash
export PROJECT_ID=dcpl-interiors
export REGION=asia-south1          # Mumbai; pick the region closest to users
export SERVICE=dcpl-backend
gcloud config set project $PROJECT_ID
```

## 1. One-time project setup

```bash
# Make sure billing is enabled on the project first (GCP console).
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

## 2. Grant the runtime service account access to Firebase

Cloud Run uses the default compute service account unless told otherwise.

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Firestore read/write
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/datastore.user"

# Firebase Auth admin (create users, password-reset links)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/firebaseauth.admin"

# Cloud Storage (attachments)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/storage.objectAdmin"

# REQUIRED for generating V4 signed/presigned upload+download URLs with ADC —
# lets the SA sign blobs as itself.
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

## 3. Storage bucket CORS (browser uploads)

Attachments/bill images upload **straight from the browser** to a presigned GCS URL
(`PUT https://storage.googleapis.com/...`). Because that's cross-origin with a
`Content-Type` header, the browser fires a CORS preflight the bucket must allow —
**without this, web uploads/reads fail silently in the browser** (native apps are
unaffected; `curl` is too, since it ignores CORS). This is the **GCS bucket** CORS,
separate from the API's `CORS_ORIGINS` env var.

One-time, per bucket (config lives at [`storage.cors.json`](storage.cors.json)):

```bash
gcloud storage buckets update gs://${PROJECT_ID}.firebasestorage.app \
  --cors-file=storage.cors.json
# verify:
gcloud storage buckets describe gs://${PROJECT_ID}.firebasestorage.app \
  --format="default(cors_config)"
```

`origin: ["*"]` is intentional — CORS isn't the security boundary here (the signed
URL's signature + short TTL + uid-scoped path are); `*` covers every random localhost
dev port plus production hosting. `GET` is included so admins can view bills/photos
(signed read URLs) from the web app, not just `PUT` uploads.

## 4. Storage lifecycle (sweep orphaned uploads)

Clients upload each attachment **immediately** (on pick / stop-recording), to a
staging prefix `tmp/…`. The backend **moves** an object to its permanent key
(`material-requests/…`, `profiles/…`) only when a saved request/profile commits to it
(`StorageService.finalizeUpload`). So anything a user uploads then removes, or never
submits, is left in `tmp/` — never referenced, never cleaned. This lifecycle rule
deletes those after 1 day; committed files have already left `tmp/`, so they're never
touched.

One-time, per bucket (config lives at [`storage.lifecycle.json`](storage.lifecycle.json)):

```bash
gcloud storage buckets update gs://${PROJECT_ID}.firebasestorage.app \
  --lifecycle-file=storage.lifecycle.json
# verify:
gcloud storage buckets describe gs://${PROJECT_ID}.firebasestorage.app \
  --format="default(lifecycle_config)"
```

1 day is a generous safety margin (uploads normally commit within minutes of submit).
The rule is scoped to `matchesPrefix: ["tmp/"]`, so it can **never** delete a committed
attachment. Note it doesn't cover files orphaned by *replacing* an already-committed one
(e.g. changing a profile photo) — those sit under the permanent prefix; handle separately
if it ever matters.

## 5. Firestore composite indexes

The list/count queries filter + order on several fields, which Firestore needs composite
indexes for; they're declared in [`firestore.indexes.json`](firestore.indexes.json). Deploy
them — and **re-deploy whenever that file changes** (e.g. a new list filter is added):

```bash
firebase deploy --only firestore:indexes --project $PROJECT_ID
```

Builds run in the **background** (a few minutes to backfill); a query that needs a
still-building index returns a "needs index" error until it's ready. `firebase deploy`
only **creates** indexes missing from the project — it won't delete ones absent from the
file unless you pass `--force` (it prints how many such indexes exist).

## 6. Store the one secret (Firebase Web API key)

```bash
printf 'YOUR_WEB_API_KEY' | gcloud secrets create FIREBASE_WEB_API_KEY \
  --data-file=- --replication-policy=automatic
gcloud secrets add-iam-policy-binding FIREBASE_WEB_API_KEY \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor"
```

## 7. Deploy

Builds the Dockerfile via Cloud Build and deploys, in one command:

```bash
gcloud run deploy $SERVICE \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=${PROJECT_ID},FIREBASE_STORAGE_BUCKET=${PROJECT_ID}.firebasestorage.app,CORS_ORIGINS=https://dcpl-interiors.web.app,https://admin-dcpl-interiors.web.app" \
  --set-secrets "FIREBASE_WEB_API_KEY=FIREBASE_WEB_API_KEY:latest"
```

The command prints a Service URL like `https://dcpl-backend-xxxxx-el.a.run.app`.

## 8. Point the apps at the new URL

- Update the Admin and User Flutter apps' API base URL to the Cloud Run URL.
- Confirm `CORS_ORIGINS` above lists every web origin that calls the API.
- Redeploy/retest, then decommission the Render service.

## Redeploys

Re-run the **Deploy** step (`gcloud run deploy ... --source .`) after any code change.
If the change adds a Firestore filter/index, also re-run the **Firestore indexes** step.

## Notes

- Scales to zero — you pay only per request. Add `--min-instances=1` if cold
  starts on the first request matter.
- Logs: `gcloud run services logs read $SERVICE --region $REGION`, or Cloud
  Console → Cloud Run → Logs.
- `--allow-unauthenticated` makes the HTTP endpoint public (the app does its own
  Firebase-token auth in middleware). Keep it; Cloud Run IAM auth would block
  your mobile clients.
