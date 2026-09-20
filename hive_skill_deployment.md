# Hive Template Importer Deployment Skill

Derived from the Hermes `deployment-workflow-hardening` skill plus the Hive-specific Traefik deployment reference.

Use this when deploying or maintaining the Hive Template Importer-style stack: **FastAPI backend + PostgreSQL database + Vite/React frontend** on **VPS number 1** behind the existing Traefik reverse proxy.

---

## Deployment shape

### VPS

```text
VPS number 1
WireGuard IP: 10.0.0.1
SSH user: root
Hostname: srv972041
password : (inside .vps file)
```

Do not store or print SSH passwords or secrets.

### App stack

```text
App path: /opt/hive-template-importer
Compose file: /opt/hive-template-importer/docker-compose.yml
Frontend container: hive-template-frontend
Backend container: hive-template-backend
Database: PostgreSQL container in same compose stack
```

### Public URLs

```text
Frontend: https://hive.100xseller.com/
Backend:  https://hiveapi.100xseller.com/
Health:   https://hiveapi.100xseller.com/health
API:      https://hiveapi.100xseller.com/api
```

### Traefik stack

```text
Traefik stack path: /root/traefik-docker
Dynamic config path: /root/traefik-docker/dynamic/hive-template-importer.yml
Existing public Docker network: proxy
```

Traefik uses the file provider and watches dynamic config files under:

```text
/root/traefik-docker/dynamic/*.yml
```

---

## Core rule

Attach only the public-facing app services to Traefik's external `proxy` network.

```text
frontend -> default app network + proxy network
backend  -> default app network + proxy network
postgres -> default app network only
```

Do **not** expose PostgreSQL publicly.

---

## Compose pattern

The Docker Compose stack should use stable container names because Traefik file-provider routes point to container DNS names.

Example pattern:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: hive
      POSTGRES_USER: hive
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - default

  backend:
    container_name: hive-template-backend
    build: ./backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql+psycopg://hive:${POSTGRES_PASSWORD}@postgres:5432/hive
    depends_on:
      - postgres
    networks:
      - default
      - proxy

  frontend:
    container_name: hive-template-frontend
    build:
      context: ./frontend
      args:
        VITE_API_BASE: https://hiveapi.100xseller.com/api
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - default
      - proxy

volumes:
  postgres_data:

networks:
  proxy:
    external: true
```

Notes:

- Keep secrets in `.env`, never in documentation or chat.
- Rebuild the frontend whenever `VITE_API_BASE` changes.
- Keep local/source compose aligned with VPS compose, otherwise redeploying source can overwrite Traefik/proxy settings.

---

## Traefik dynamic config pattern

File:

```text
/root/traefik-docker/dynamic/hive-template-importer.yml
```

Pattern:

```yaml
http:
  routers:
    hive-template-frontend:
      rule: Host(`hive.100xseller.com`)
      entryPoints:
        - websecure
      service: hive-template-frontend
      tls:
        certResolver: letsencrypt

    hive-template-backend:
      rule: Host(`hiveapi.100xseller.com`)
      entryPoints:
        - websecure
      service: hive-template-backend
      tls:
        certResolver: letsencrypt

  services:
    hive-template-frontend:
      loadBalancer:
        servers:
          - url: "http://hive-template-frontend:80"
        passHostHeader: true

    hive-template-backend:
      loadBalancer:
        servers:
          - url: "http://hive-template-backend:8000"
        passHostHeader: true
```

Traefik usually reloads this file automatically. A full Traefik restart is normally not required.

---

## Deployment workflow

### 1. Inspect before changing

Before edits or restarts:

```bash
cd /opt/hive-template-importer
pwd
docker compose ps
docker compose config >/tmp/hive-template-importer-compose-check.txt
```

Check Traefik:

```bash
cd /root/traefik-docker
docker compose ps
```

Check proxy network:

```bash
docker network inspect proxy --format '{{json .Containers}}'
```

### 2. Apply app changes

Update source under:

```text
/opt/hive-template-importer
```

For frontend API-base or UI changes, rebuild frontend:

```bash
cd /opt/hive-template-importer
docker compose up -d --build frontend
```

For backend parser/API changes, rebuild backend:

```bash
cd /opt/hive-template-importer
docker compose up -d --build backend
```

For full app rebuild:

```bash
cd /opt/hive-template-importer
docker compose config >/tmp/hive-template-importer-compose-check.txt
docker compose up -d --build --remove-orphans
```

Do not delete database volumes unless the user explicitly approves.

### 3. Verify internal container reachability

From Traefik container:

```bash
docker exec traefik sh -c 'wget -qO- http://hive-template-frontend/ | head -c 80; echo'
docker exec traefik sh -c 'wget -qO- http://hive-template-backend:8000/health; echo'
```

Expected backend health:

```json
{"ok": true}
```

### 4. Verify forced-host routing from VPS

```bash
curl -kI --resolve hive.100xseller.com:443:127.0.0.1 https://hive.100xseller.com/
curl -k --resolve hiveapi.100xseller.com:443:127.0.0.1 https://hiveapi.100xseller.com/health
```

### 5. Verify public HTTPS

From outside the VPS / assistant environment:

```bash
curl -fsS https://hive.100xseller.com/ >/dev/null
curl -fsS https://hiveapi.100xseller.com/health
curl -fsS https://hiveapi.100xseller.com/api/templates >/dev/null
```

Expected:

```text
Frontend: 200 OK
Backend health: 200 OK {"ok":true}
Templates API: 200 OK
```

### 6. Check Traefik logs if anything fails

```bash
docker logs --tail 100 traefik | grep -Ei 'hive|error|certificate|acme|502|bad gateway'
```

---

## Functional smoke tests

After each meaningful backend/frontend deployment:

1. Frontend opens:

```bash
curl -fsS https://hive.100xseller.com/ >/dev/null
```

2. Backend health works:

```bash
curl -fsS https://hiveapi.100xseller.com/health
```

3. Templates list works:

```bash
curl -fsS https://hiveapi.100xseller.com/api/templates
```

4. Import test with known template file if needed:

```bash
curl -sS -X POST https://hiveapi.100xseller.com/api/imports \
  -F method=parser \
  -F 'file=@/path/to/template.csv;filename=template.csv'
```

5. Confirm imported template details:

```bash
curl -fsS https://hiveapi.100xseller.com/api/templates/<template_id>
```

6. Browser/UI check:

- Template list displays.
- Select a template.
- Section/item/comment tree renders.
- Copy template works.
- Edit/save persists after refresh.

---

## Source-code archive workflow

When sharing source code:

- Create a clean ZIP.
- Exclude generated/runtime/secret-prone files:

```text
.git/
frontend/node_modules/
frontend/dist/
__pycache__/
*.pyc
.env
```

- Include:

```text
backend/
frontend/
resources/
docker-compose.yml
README.md
NOTES.md
VERIFY.md
PLAN_AND_SCHEMA.md
```

- Verify ZIP integrity and provide SHA256.

Example using Python when `zip` is unavailable:

```bash
cd /opt/data/hive-template-importer
python3 - <<'PY'
from pathlib import Path
import zipfile
root = Path('.')
out = Path('/opt/data/hive-template-importer-source.zip')
exclude_parts = {'.git', 'node_modules', 'dist', '__pycache__'}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if not p.is_file():
            continue
        if any(part in exclude_parts for part in p.parts):
            continue
        if p.suffix == '.pyc' or p.name == '.env':
            continue
        z.write(p, p.as_posix())
print(out)
PY
sha256sum /opt/data/hive-template-importer-source.zip
```

---

## Common pitfalls

### 1. Frontend calls wrong API URL

If frontend loads but data/API fails, check that it was built with:

```text
VITE_API_BASE=https://hiveapi.100xseller.com/api
```

Then rebuild frontend.

### 2. Traefik 502 Bad Gateway

First test internal reachability from Traefik:

```bash
docker exec traefik sh -c 'wget -qO- http://hive-template-backend:8000/health'
```

If this fails:

- backend container may be down
- backend may listen on the wrong port
- backend may not be on `proxy` network
- container name may not match Traefik dynamic config

### 3. ACME/certificate issue

Check:

```bash
docker logs --tail 100 traefik | grep -Ei 'acme|certificate|hive'
```

Make sure DNS records point to VPS1 before expecting certificate issuance.

### 4. Compose overwritten during redeploy

If a local source copy is pushed to VPS and overwrites compose, ensure it still contains:

```yaml
container_name: hive-template-frontend
container_name: hive-template-backend
networks:
  proxy:
    external: true
```

And frontend build args still contain the public backend API base.

### 5. Database data loss

Never run destructive commands like this unless explicitly approved:

```bash
docker compose down -v
```

`-v` removes database volumes.

### 6. Uploaded Spectora exports are `.xls` but actually OOXML

Some Spectora exports have `.xls` extension but begin with ZIP/OOXML bytes:

```text
PK\x03\x04
```

The importer should treat those as Excel OOXML workbooks and read columns like:

```text
Section Name
Item Name
Comment Name
Comment Text
Comment Type (info, limit, defect)
Category (-1: Low, 0: Med, 1: High)
Multiple Choice Options (comma-separated)
Unit Type Options (numeric answers only, comma-separated)
Recommendation (from list)
Order (w/i item)
Answer Type (boolean, checkbox, date, number, range, text)
Default Value
```

Map them into:

```text
Section Name -> template_sections.title
Item Name -> template_items.title
Comment Name / Comment Text -> template_comments.text
Comment Type -> template_comments.comment_type
Order (w/i item) -> comment sort order within parent item
Source row -> source_ref/template_raw_rows.row_number
```

---

## Completion criteria

A Hive deployment is complete only when these checks pass:

```text
https://hive.100xseller.com/                  200 OK
https://hiveapi.100xseller.com/health         200 OK {"ok":true}
https://hiveapi.100xseller.com/api/templates  200 OK
```

And the UI can:

- display templates
- open a template
- show sections/items/comments
- import a provided template file
- copy a template
- edit/save a comment
- preserve data after container restart

---

## Current known Hive app values

```text
Frontend domain: hive.100xseller.com
Backend domain: hiveapi.100xseller.com
App path on VPS: /opt/hive-template-importer
Traefik dynamic config: /root/traefik-docker/dynamic/hive-template-importer.yml
Source archive: /opt/data/hive-template-importer-source.zip
Local project copy: /opt/data/hive-template-importer
```
