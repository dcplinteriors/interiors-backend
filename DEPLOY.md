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

## 3. Store the one secret (Firebase Web API key)

```bash
printf 'YOUR_WEB_API_KEY' | gcloud secrets create FIREBASE_WEB_API_KEY \
  --data-file=- --replication-policy=automatic
gcloud secrets add-iam-policy-binding FIREBASE_WEB_API_KEY \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor"
```

## 4. Deploy

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

## 5. Point the apps at the new URL

- Update the Admin and User Flutter apps' API base URL to the Cloud Run URL.
- Confirm `CORS_ORIGINS` above lists every web origin that calls the API.
- Redeploy/retest, then decommission the Render service.

## Redeploys

Re-run step 4 (`gcloud run deploy ... --source .`) after any code change.

## Notes

- Scales to zero — you pay only per request. Add `--min-instances=1` if cold
  starts on the first request matter.
- Logs: `gcloud run services logs read $SERVICE --region $REGION`, or Cloud
  Console → Cloud Run → Logs.
- `--allow-unauthenticated` makes the HTTP endpoint public (the app does its own
  Firebase-token auth in middleware). Keep it; Cloud Run IAM auth would block
  your mobile clients.
