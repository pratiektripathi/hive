#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${APP_PATH:-/opt/hive-template-importer}"
TRAEFIK_DYNAMIC="${TRAEFIK_DYNAMIC:-/root/traefik-docker/dynamic/hive-template-importer.yml}"

cd "$APP_PATH"
pwd

if [[ ! -f .env ]]; then
  if [[ -z "${POSTGRES_PASSWORD:-}" || -z "${SECRET_KEY:-}" ]]; then
    echo "Missing .env and POSTGRES_PASSWORD/SECRET_KEY were not provided." >&2
    exit 1
  fi
  cat > .env <<EOF
POSTGRES_DB=${POSTGRES_DB:-hive}
POSTGRES_USER=${POSTGRES_USER:-hive}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
SECRET_KEY=${SECRET_KEY}
ALGORITHM=${ALGORITHM:-HS256}
ACCESS_TOKEN_EXPIRE_MINUTES=${ACCESS_TOKEN_EXPIRE_MINUTES:-60}
ENVIRONMENT=production
FRONTEND_URL=${FRONTEND_URL:-https://hive.100xseller.com}
BACKEND_URL=${BACKEND_URL:-https://hiveapi.100xseller.com}
VITE_API_BASE=${VITE_API_BASE:-https://hiveapi.100xseller.com/api}
EOF
  chmod 600 .env
fi

docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

if [[ -f deploy/traefik/hive-template-importer.yml && -d /root/traefik-docker/dynamic ]]; then
  if [[ -w /root/traefik-docker/dynamic ]]; then
    cp deploy/traefik/hive-template-importer.yml "$TRAEFIK_DYNAMIC"
  else
    sudo cp deploy/traefik/hive-template-importer.yml "$TRAEFIK_DYNAMIC"
  fi
fi

docker compose config >/tmp/hive-template-importer-compose-check.txt
docker compose up -d --build --remove-orphans

docker compose ps

echo "Waiting for backend health..."
for _ in $(seq 1 30); do
  if docker exec hive-template-backend python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if docker exec traefik sh -c 'wget -qO- http://hive-template-backend:8000/health' 2>/dev/null; then
  echo
fi

curl -kI --resolve hive.100xseller.com:443:127.0.0.1 https://hive.100xseller.com/ | head -n 20
curl -k --resolve hiveapi.100xseller.com:443:127.0.0.1 https://hiveapi.100xseller.com/health
echo
