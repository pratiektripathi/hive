# NOTES

## What was built
A working containerized web app to import home-inspection template exports, normalize them into sections/items/comments, edit content, and copy templates independently.

## Import methods
1. Deterministic parser: parses CSV/TSV-style Spectora HTML Text exports and preserves order, raw row data, and warnings.
2. AI-assisted: endpoint exists and records an AI validation run. If no AI provider key is configured, it safely falls back to parser output and logs an info warning rather than inventing mappings.

## Research limitations
Spectora/Hive trial signup was attempted through browser automation with dummy phone details as requested. Dashboard/template export access was not reached because account creation did not complete reliably in the remote browser. Binsr was inaccessible/unconfigured. Representative fixture exports are included so the app can be developed and verified in one day; replace these with real Spectora exports when account access is available.

## Known limitations
- XLSX support can be added; current MVP focuses on CSV/HTML Text exports.
- AI import requires `OPENAI_API_KEY` or another provider to be wired in.
- Authentication is not included because assignment focuses on import/edit/copy workflow.
