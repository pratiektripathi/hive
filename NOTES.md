# NOTES

What we cut and why, supported input and limitations, how we checked the work, time spent, and credits for starters and libraries.

---

## What we cut and why

We shipped the baseline first — **import → edit → copy → persist** — then stopped deliberately.

| Left out | Why |
| --- | --- |
| Inspection reports, scheduling, payments, homeowner portals | Out of scope per the assignment |
| Mobile app | Desk web workflow only |
| Hosting on Vercel | Needs Postgres + file storage; hosted on VPS behind Traefik (see README) |
| Full Spectora editor parity | Faithful import + editable structure matters more than cloning Spectora |
| Deep org / roles beyond per-user ownership | One authenticated user’s templates is enough for the baseline |
| Binsr as a required product track | Optional; time went into import fidelity and a usable editor |
| Info-category detection (item/section has no defect) | Export has no clear signal we could map in the timebox; we do not invent defect vs info |
| Defect label from the export Excel | No trustworthy field to map; left unmapped rather than guessing |
| Ignored Spectora columns (listed below) | Not needed for baseline edit/copy; kept on raw rows / warnings, not silently dropped |

**Ignored columns:** `Default Estimate Min`, `Default Estimate Max`, `Locked`, `Simple Format`, `disable photos`, `uses`

**Extra time went into:** import trust (column mapping, warnings, honest AI fallback) and an inspector-friendly editor (onboarding tour, rich-text comments).

---

## Supported input and known limitations

### Supported

- Spectora **Export to spreadsheet → Export HTML Text** (`.csv`, `.tsv`, `.xlsx`; also `.xls` that are actually OOXML)
- Structured model: templates → sections → items → comments (not one opaque HTML blob)
- Order and hierarchy preserved; skipped / unmapped content shown as warnings
- Edit section names, item names, and comment text; save to PostgreSQL
- Independent template copy (edits on the copy leave the original unchanged)
- Optional AI column mapping when `OPENAI_API_KEY` is set; otherwise heuristic parser with recorded fallback

### Limitations

- Cannot tell whether an item or section is an **info category** (no defect) from the export alone
- Cannot map a **defect label** from the Spectora export into a first-class field
- Columns above are intentionally ignored (still visible on raw import rows / warnings)
- Content missing from the Spectora export cannot be reconstructed; unmapped content is not silently dropped
- Plain-text Spectora export (non HTML-text spreadsheet) is not supported
- AI mapping can return bad output — we validate and fall back to the deterministic parser

---

## How we checked our work

1. **Import** — imported **5 Spectora HTML-text exports** and checked sections, items, comments, order, and warnings
2. **Spectora round-trip** — edited in Spectora → exported HTML Text → imported into our app; confirmed edits survived
3. **Edit** — changed section / item / comment content in our app, saved, reloaded; changes persisted in PostgreSQL
4. **Copy** — duplicated a template, edited the copy, confirmed the original was unchanged
5. **Store** — templates still present after app / container restart
6. **Failure case** — invalid or empty upload returns warnings / errors without crashing
7. **AI path** — with no provider key, AI import records fallback and does not invent mappings

**Live**

- Frontend: https://hive.100xseller.com/
- API: https://hiveapi.100xseller.com/
- Health: https://hiveapi.100xseller.com/health

More detail in `VERIFY.md`.

---

## Approximate time spent

| | |
| --- | --- |
| **Started** | 20 September 2026, 9:00 AM |
| **Finished** | 21 September 2026, 1:42 AM |
| **Duration** | ~16.5 hours wall-clock across two calendar days |

Covered product exploration, schema / API, importer, editor UI, Docker deploy, verification, and this NOTES file.

---

## Credits

### Starter

**[pratiektripathi/base](https://github.com/pratiektripathi/base.git)** — auth (JWT login / signup), basic FastAPI backend, Vite + React frontend, and shadcn/ui.

Built on top of that base: Spectora import, template model, editor, copy workflow, warnings, AI-assisted mapping, and deployment. The starter itself is not the product.

### Also used

| | Role |
| --- | --- |
| shadcn/ui + Radix UI | Accessible UI primitives (from the base app) |
| Plate / PlateJS | Rich-text editing for comment bodies |
| FastAPI + SQLModel + Alembic + PostgreSQL | API, models, migrations, persistence |
| OpenAI API | Optional import mapping (validated; falls back honestly) |
| Cursor / AI coding tools | Used to build and refine; we reviewed and own what shipped |

---

## Libraries and purpose

### Backend

| Library | Purpose |
| --- | --- |
| FastAPI | REST API for auth, import, templates, edit, copy |
| Uvicorn / Gunicorn | Run the API in Docker |
| SQLModel | ORM for templates, sections, items, comments, imports, warnings |
| asyncpg | Async Postgres driver for the API |
| psycopg2-binary | Sync Postgres driver for Alembic |
| Alembic | Database schema migrations |
| Pydantic / pydantic-settings | Request / response models and env config |
| python-dotenv | Local `.env` loading |
| python-multipart | Spreadsheet file uploads |
| Passlib + bcrypt | Password hashing |
| PyJWT | Auth tokens / user-scoped template access |
| openpyxl | Read / write Spectora XLSX (and OOXML-as-`.xls`) exports |
| OpenAI | Optional AI column / recommendation mapping |

### Frontend

| Library | Purpose |
| --- | --- |
| React + TypeScript + Vite | Web UI build and runtime |
| react-router-dom | Login, templates, import, editor routes |
| axios | Calls to the FastAPI backend |
| Tailwind CSS | Styling |
| Radix UI / shadcn-style components | Accessible UI primitives |
| Plate / @platejs/* | Rich-text comment editing after import |
| react-dnd | Drag-and-drop in the editor |
| lucide-react | Icons |
| sonner | Save / upload / error toasts |
| react-joyride | Onboarding tour for inspectors |
| use-file-picker | File picking in editor / import flows |
| cva / clsx / tailwind-merge / @udecode/cn | Component variants and class merging |
| @tanstack/react-table | Table UIs adapted from the starter |
| zod | Client form / schema validation |
| lodash | Small UI data helpers |

### Infrastructure

| Tool | Purpose |
| --- | --- |
| Docker Compose | Frontend + backend + Postgres |
| Traefik (VPS) | Public HTTPS routing |
| GitHub Actions | Deploy to the VPS |
| PostgreSQL 16 | Durable storage for templates, edits, and copies |
