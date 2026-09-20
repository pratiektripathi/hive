# Hive Inspect Template Importer — 1-Day Containerized Delivery Plan

## User constraints
- Stack: FastAPI + PostgreSQL + Vite React.
- All services containerized.
- Deploy on VPS number 1, not Vercel.
- Build within one day.
- Use two import methods: deterministic parser and AI-assisted mapping.
- Collect website/app resources and screenshots from Hive Inspect, Spectora, and Binsr if accessible.
- Download InterNACHI and at least five Spectora HTML-text template exports if trial access allows.
- After build, load templates and verify; if output is poor, replan/fix and retest.

## Delivery phases
1. Product exploration and resource capture
   - Inspect Hive Inspect, Spectora, and Binsr.
   - Create trial accounts where allowed with dummy/non-sensitive details; pause for OTP/CAPTCHA/email verification if required.
   - Download/shareable template exports from Spectora: InterNACHI Residential plus at least five more if available.
   - Save screenshots to `resources/screenshots/` and exports to `resources/spectora-exports/`.
2. Database/schema implementation
   - Create normalized model for templates, sections, items, comments, raw rows, import warnings, and AI mapping runs.
   - Scope every tenant-owned row with `user_id` so one user cannot access another user's data.
3. Backend implementation
   - FastAPI API for imports, template tree retrieval, editing, copying, warnings, seed templates.
   - Parser importer primary; AI-assisted importer secondary with validation and honest failure.
4. Frontend implementation
   - Vite React UI: import screen, template list, editor tree/detail, warnings panel, copy workflow.
5. Container deployment on VPS number 1
   - Docker Compose: frontend, backend, postgres.
   - Attach to existing Traefik if needed, or expose a VPS-bound port for demo.
6. Verification/fix loop
   - Import all collected templates.
   - Verify edit/save/copy/persistence/failure case.
   - Fix issues and retest.
7. Submission assets
   - README, NOTES, screenshots, seed exports, walkthrough script notes.

## Schema

Every tenant-owned table stores `user_id` FK `user(id)`. API reads/writes must filter by the authenticated user so one account cannot see or change another user's data.

### user
- id int PK
- firstname text not null
- lastname text not null
- username text not null unique
- password text not null
- phone text
- theme enum: light | dark default light
- isEnable boolean default true
- created_by int nullable FK user(id)
- created_at timestamptz

### apikey
- id int PK
- user_id int NOT NULL FK user(id) on delete cascade
- key text not null unique
- created_at timestamptz

### templates
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- name text not null
- source_system text default 'spectora'
- source_template_name text
- source_file_name text
- description text
- import_method text not null: parser | ai | hybrid | sample
- parent_template_id UUID nullable FK templates(id)
- is_seed boolean default false
- created_at timestamptz
- updated_at timestamptz

### template_imports
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- template_id UUID FK templates(id) on delete cascade
- source_file_name text not null
- source_file_hash text not null
- import_method text not null
- status text not null: success | partial | failed
- total_rows int default 0
- imported_sections int default 0
- imported_items int default 0
- imported_comments int default 0
- unsupported_count int default 0
- raw_metadata jsonb default '{}'
- created_at timestamptz

### template_sections
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- template_id UUID FK templates(id) on delete cascade
- parent_section_id UUID nullable FK template_sections(id)
- title text not null
- description text
- icon text
- sort_order int not null
- source_ref text
- raw_html text
- created_at timestamptz
- updated_at timestamptz

### template_items
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- template_id UUID FK templates(id) on delete cascade
- section_id UUID FK template_sections(id) on delete cascade
- title text not null
- description text
- sort_order int not null
- source_ref text
- raw_html text
- created_at timestamptz
- updated_at timestamptz

### template_comments
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- template_id UUID NOT NULL FK templates(id) on delete cascade
- section_id UUID FK template_sections(id) on delete cascade
- item_id UUID FK template_items(id) on delete cascade
- name text
- text text
- rich_text_html text
- raw_html text
- type enum: info | limit | defect
- category enum: low | med | high
- answer_type enum: text | checkbox | date | range | boolean | number
- default_value text
- default_value2 text                # for range type
- default_unit text                  # for range & number type
- unit_type text[]                   # list of units
- mchoice text[]                     # multiple choice options
- default_estimation_min number
- default_estimation_max number
- default_location text
- pos int not null                   # order within item
- created_at timestamptz
- updated_at timestamptz

### import_warnings
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- import_id UUID FK template_imports(id) on delete cascade
- template_id UUID FK templates(id) on delete cascade
- severity text: info | warning | error
- code text not null
- message text not null
- source_row int nullable
- source_column text nullable
- raw_content text nullable
- created_at timestamptz

### template_raw_rows
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- import_id UUID FK template_imports(id) on delete cascade
- template_id UUID FK templates(id) on delete cascade
- row_number int not null
- row_data jsonb not null
- detected_type text: section | item | comment | unknown
- mapped_entity_type text nullable
- mapped_entity_id UUID nullable
- created_at timestamptz

### ai_import_runs
- id UUID PK
- user_id int NOT NULL FK user(id) on delete cascade
- import_id UUID FK template_imports(id) on delete cascade
- model_name text
- prompt_version text
- input_summary jsonb
- output_json jsonb
- validation_status text: valid | malformed | partial | rejected | unavailable
- validation_errors jsonb default '[]'
- created_at timestamptz

## Parser method
- Accept .csv/.tsv/.xlsx/.html/.htm.
- Extract rows/cells; preserve raw cell text/html.
- Detect columns and row hierarchy using headers, indentation, numbering, bold headings, row ordering, and keywords.
- Create sections/items/comments with warnings for ambiguous/unsupported rows.

## AI-assisted method
- Parser runs first.
- AI maps ambiguous rows to section/item/comment JSON.
- Validate output; reject malformed/invented/dropped content.
- Fall back to parser and log warning if AI unavailable or invalid.

## Verification checklist
- `docker compose up -d --build` works on VPS1.
- Backend `/health` responds.
- Frontend opens.
- At least one seed template loads.
- Import parser path works.
- Import AI path either works or shows validated/unavailable status honestly.
- Edit/save persists after refresh.
- Copy is independent from original.
- A user cannot read or write another user's templates or related rows.
- Invalid upload shows error/warnings without crash.
- Container restart preserves data.
