#!/usr/bin/env bash
# Deploys only the @prediction-club/chainworker service.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$REPO_ROOT"

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  echo "[deploy] Loading env from $DEPLOY_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[deploy] Missing required env var: ${name}" >&2
    exit 1
  fi
}

command -v gcloud >/dev/null 2>&1 || {
  echo "[deploy] gcloud is required but was not found in PATH." >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "[deploy] docker is required but was not found in PATH." >&2
  exit 1
}

GCP_ARTIFACT_REGION="${GCP_ARTIFACT_REGION:-us-central1}"
GCP_ARTIFACT_REPO="${GCP_ARTIFACT_REPO:-prediction-club}"
GCP_IMAGE_NAME="${GCP_IMAGE_NAME:-prediction-chainworker}"
GCP_IMAGE_TAG="${GCP_IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
DOCKER_BUILD_PLATFORM="${DOCKER_BUILD_PLATFORM:-linux/amd64}"
SKIP_BUILD_PUSH="${SKIP_BUILD_PUSH:-false}"
GCP_VM_USER="${GCP_VM_USER:-}"
SERVICE_NAME="${SERVICE_NAME:-prediction-chainworker}"
CHAINWORKER_ENV_FILE="${CHAINWORKER_ENV_FILE:-${SCRIPT_DIR}/.env}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-/tmp/${SERVICE_NAME}.env}"
REMOTE_DOCKER_USE_SUDO="${REMOTE_DOCKER_USE_SUDO:-false}"

require_var "GCP_PROJECT_ID"
require_var "GCP_ZONE"
require_var "GCP_VM_NAME"

if [[ ! -f "$CHAINWORKER_ENV_FILE" ]]; then
  echo "[deploy] Env file not found: $CHAINWORKER_ENV_FILE" >&2
  exit 1
fi

TARGET_HOST="$GCP_VM_NAME"
if [[ -n "$GCP_VM_USER" ]]; then
  TARGET_HOST="${GCP_VM_USER}@${GCP_VM_NAME}"
fi

IMAGE_URI="${GCP_ARTIFACT_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPO}/${GCP_IMAGE_NAME}:${GCP_IMAGE_TAG}"
REGISTRY_HOST="${GCP_ARTIFACT_REGION}-docker.pkg.dev"

echo "[deploy] Image: $IMAGE_URI"
echo "[deploy] VM: $TARGET_HOST ($GCP_ZONE)"
echo "[deploy] Service: $SERVICE_NAME"
echo "[deploy] Build platform: $DOCKER_BUILD_PLATFORM"
echo "[deploy] Skip build/push: $SKIP_BUILD_PUSH"

echo "[deploy] Checking Docker availability on VM"
if [[ "$REMOTE_DOCKER_USE_SUDO" == "true" ]]; then
  if ! gcloud compute ssh "$TARGET_HOST" \
    --zone="$GCP_ZONE" \
    --project="$GCP_PROJECT_ID" \
    --command "command -v docker >/dev/null 2>&1 || sudo -n command -v docker >/dev/null 2>&1"; then
    echo "[deploy] Docker is not available on the VM. Install Docker first, or ensure sudo can run docker non-interactively." >&2
    exit 1
  fi
else
  if ! gcloud compute ssh "$TARGET_HOST" \
    --zone="$GCP_ZONE" \
    --project="$GCP_PROJECT_ID" \
    --command "command -v docker >/dev/null 2>&1"; then
    echo "[deploy] Docker is not available on the VM PATH. Install Docker or set REMOTE_DOCKER_USE_SUDO=true." >&2
    exit 1
  fi
fi

if ! gcloud artifacts repositories describe \
  "$GCP_ARTIFACT_REPO" \
  --location="$GCP_ARTIFACT_REGION" \
  --project="$GCP_PROJECT_ID" >/dev/null 2>&1; then
  echo "[deploy] Creating missing Artifact Registry repo: $GCP_ARTIFACT_REPO"
  gcloud artifacts repositories create "$GCP_ARTIFACT_REPO" \
    --location="$GCP_ARTIFACT_REGION" \
    --repository-format=docker \
    --description="Prediction Club container images" \
    --project="$GCP_PROJECT_ID"
fi

echo "[deploy] Configuring docker auth for Artifact Registry"
gcloud auth configure-docker "${REGISTRY_HOST}" --quiet

if [[ "$SKIP_BUILD_PUSH" == "true" ]]; then
  echo "[deploy] Skipping image build/push and using existing image: $IMAGE_URI"
else
  if docker buildx version >/dev/null 2>&1; then
    echo "[deploy] Building and pushing image via buildx"
    docker buildx build \
      --platform "$DOCKER_BUILD_PLATFORM" \
      -f "${SCRIPT_DIR}/Dockerfile" \
      -t "$IMAGE_URI" \
      --push \
      .
  else
    echo "[deploy] Building image"
    docker build --platform "$DOCKER_BUILD_PLATFORM" -f "${SCRIPT_DIR}/Dockerfile" -t "$IMAGE_URI" .
    echo "[deploy] Pushing image"
    docker push "$IMAGE_URI"
  fi
fi

echo "[deploy] Uploading env file to VM: $CHAINWORKER_ENV_FILE -> $REMOTE_ENV_FILE"
gcloud compute scp "$CHAINWORKER_ENV_FILE" "${TARGET_HOST}:${REMOTE_ENV_FILE}" \
  --zone="$GCP_ZONE" \
  --project="$GCP_PROJECT_ID"

echo "[deploy] Updating running container on VM"
gcloud compute ssh "$TARGET_HOST" \
  --zone="$GCP_ZONE" \
  --project="$GCP_PROJECT_ID" \
  --command "bash -s" <<EOF
set -euo pipefail

DOCKER_BIN="docker"
if [[ "${REMOTE_DOCKER_USE_SUDO}" == "true" ]]; then
  DOCKER_BIN="sudo docker"
fi

command -v gcloud >/dev/null 2>&1 || {
  echo "[deploy] gcloud is required on the VM for Artifact Registry auth." >&2
  exit 1
}

gcloud auth print-access-token | \$DOCKER_BIN login -u oauth2accesstoken --password-stdin "https://${REGISTRY_HOST}" >/dev/null

\$DOCKER_BIN pull "${IMAGE_URI}"

if \$DOCKER_BIN ps -a --format '{{.Names}}' | grep -qx "${SERVICE_NAME}"; then
  \$DOCKER_BIN rm -f "${SERVICE_NAME}"
fi

\$DOCKER_BIN run -d \
  --name "${SERVICE_NAME}" \
  --restart unless-stopped \
  --env-file "${REMOTE_ENV_FILE}" \
  "${IMAGE_URI}"

\$DOCKER_BIN image prune -f >/dev/null 2>&1 || true
EOF

echo "[deploy] Done."
