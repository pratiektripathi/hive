#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting API..."
exec gunicorn --chdir /app/app main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --keep-alive 5
