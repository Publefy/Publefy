#!/usr/bin/env bash
set -euo pipefail

ENVIRON="${1:-}"  # dev or prod
if [[ "$ENVIRON" != "dev" && "$ENVIRON" != "prod" ]]; then
  echo "Usage: refresh.sh [dev|prod]"; exit 2
fi

if [[ "$ENVIRON" == "dev" ]]; then
  APP_DIR="/opt/publefy-dev"
  COMPOSE="/opt/publefy-dev/compose/docker-compose.dev.yml"
else
  APP_DIR="/opt/publefy-prod"
  COMPOSE="/opt/publefy-prod/compose/docker-compose.prod.yml"
fi

sudo mkdir -p "$APP_DIR/compose"
sudo touch "$APP_DIR/.env.dev" "$APP_DIR/.env" || true

echo "[refresh] docker login GHCR"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

echo "[refresh] pulling $ENVIRON image(s)"
GIT_SHA="${GIT_SHA:-latest}" docker compose -f "$COMPOSE" pull

echo "[refresh] up -d $ENVIRON"
GIT_SHA="${GIT_SHA:-latest}" docker compose -f "$COMPOSE" up -d

echo "[refresh] prune old images"
docker image prune -f
