#!/usr/bin/env bash
# Basic VM setup for chainworker: Docker + Google Cloud Ops Agent (Docker logs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${SCRIPT_DIR}/.env}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  echo "[setup] Loading env from $DEPLOY_ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[setup] Missing required command: $1" >&2
    exit 1
  fi
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[setup] Missing required env var: ${name}" >&2
    exit 1
  fi
}

SKIP_SSH="${SKIP_SSH:-false}"
GCP_VM_USER="${GCP_VM_USER:-}"
ADD_DOCKER_GROUP="${ADD_DOCKER_GROUP:-false}"

if [[ "$SKIP_SSH" != "true" ]]; then
  require_cmd gcloud
  require_var "GCP_PROJECT_ID"
  require_var "GCP_ZONE"
  require_var "GCP_VM_NAME"

  TARGET_HOST="$GCP_VM_NAME"
  if [[ -n "$GCP_VM_USER" ]]; then
    TARGET_HOST="${GCP_VM_USER}@${GCP_VM_NAME}"
  fi

  echo "[setup] Running setup on $TARGET_HOST ($GCP_ZONE)"
  echo "[setup] ADD_DOCKER_GROUP: $ADD_DOCKER_GROUP"

  gcloud compute ssh "$TARGET_HOST" \
    --zone="$GCP_ZONE" \
    --project="$GCP_PROJECT_ID" \
    --command "ADD_DOCKER_GROUP=${ADD_DOCKER_GROUP} SKIP_SSH=true bash -s" < "${SCRIPT_DIR}/vm-setup.sh"
  echo "[setup] Remote setup complete."
  exit 0
fi

require_cmd sudo
require_cmd curl

if command -v apt-get >/dev/null 2>&1; then
  echo "[setup] Updating apt cache"
  sudo apt-get update -y
else
  echo "[setup] This script currently supports apt-based distros only." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[setup] Installing Docker"
  sudo apt-get install -y docker.io
  sudo systemctl enable --now docker
else
  echo "[setup] Docker already installed"
fi

if [[ "$ADD_DOCKER_GROUP" == "true" ]]; then
  echo "[setup] Adding current user to docker group"
  sudo usermod -aG docker "$USER" || true
  echo "[setup] You may need to log out/in for group changes to take effect."
fi

if ! systemctl status google-cloud-ops-agent --no-pager >/dev/null 2>&1; then
  echo "[setup] Installing Google Cloud Ops Agent"
  curl -sS https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh -o /tmp/add-ops-agent.sh
  sudo bash /tmp/add-ops-agent.sh --also-install
else
  echo "[setup] Ops Agent already installed"
fi

echo "[setup] Configuring Ops Agent to collect Docker logs"
sudo mkdir -p /etc/google-cloud-ops-agent/config.yaml.d
sudo tee /etc/google-cloud-ops-agent/config.yaml.d/docker-logs.yaml >/dev/null <<'EOF'
logging:
  receivers:
    docker:
      type: files
      include_paths:
        - /var/lib/docker/containers/*/*-json.log
      record_log_file_path: true
  service:
    pipelines:
      docker:
        receivers: [docker]
EOF

echo "[setup] Restarting Ops Agent"
sudo systemctl restart google-cloud-ops-agent
sudo systemctl status google-cloud-ops-agent --no-pager | sed -n '1,12p'

echo "[setup] VM setup complete."
