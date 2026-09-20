# Hive Inspect Template Importer

Containerized FastAPI + PostgreSQL + Vite React MVP for importing Spectora HTML-text spreadsheet exports into a normalized template editor.

## Run locally

```bash
docker compose up -d --build
open http://localhost:8094
```

## Features
- Parser importer for Spectora-style HTML Text CSV exports.
- AI-assisted import endpoint with schema validation/fallback recording.
- Normalized database: templates, sections, items, comments, raw rows, warnings, AI runs.
- Template edit/save.
- Independent template copy.
- Seed templates loaded from `resources/spectora-exports/`.

## Database migrations

Schema changes go through Alembic. Production applies `alembic upgrade head` when the backend container starts.

```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

`DATABASE_URL` must be set. Local Alembic loads `backend/app/.env`; Compose sets it for the backend service.

## Deployment

Production stack on VPS 1 (`10.0.0.1`) behind Traefik:

- Frontend: https://hive.100xseller.com/
- Backend: https://hiveapi.100xseller.com/
- Health: https://hiveapi.100xseller.com/health

Push to `main` runs `.github/workflows/deploy.yml`, which rsyncs to `/opt/hive-template-importer` and rebuilds Compose. Keep the VPS `.env` on the server; GitHub needs `VPS_SSH_KEY` or `VPS_PASSWORD`, plus `POSTGRES_PASSWORD` and `SECRET_KEY` for the first deploy.
