#!/bin/bash
set -e

# ─── Config ───────────────────────────────────────────────────
PROJECT_ID="giorgiogilbert-family-tree"
SERVICE_NAME="family-tree"
REGION="europe-west1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"
# ──────────────────────────────────────────────────────────────

echo "🔨 Building image..."
gcloud builds submit --tag "$IMAGE" .

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets GOOGLE_APPLICATION_CREDENTIALS_JSON=firebase-service-account:latest

echo "✅ Deploy completato!"
echo "🌍 URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"