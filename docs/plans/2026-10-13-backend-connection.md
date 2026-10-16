# Backend Connection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the approved light mint frontend the default application and connect it to the existing local PostgreSQL/FastAPI backend.

**Architecture:** Reuse the existing same-origin Vite `/api` proxy, session cookie, persisted account ledger and idempotent operations. Transfer forms submit server drafts and show only server confirmation snapshots; refresh updates all views from the server. Keep the accepted UI and existing local-only capabilities intact, document their boundaries, and do not develop the Agent.

**Tech Stack:** React, Vite, FastAPI, SQLAlchemy, psycopg, PostgreSQL, existing Playwright and pytest.

## Task 1: Promote the approved UI

- Modify `src/main.jsx`, `src/App.jsx`, `index.html`, `qinghe-ui-preview.html`.
- Load the approved CSS from the default entry, start on overview, keep the old preview URL as an alias with no route-reset observer.
- Check desktop/mobile screenshots and the existing 13 route navigation checks; `npm run build` must pass.

## Task 2: Restore local backend service

- Inspect existing runtime without printing secrets. Reuse `.env`, `.venv`, `compose.yaml` and the project database volume; do not reset or delete existing data.
- Start PostgreSQL, run `.venv/Scripts/python.exe -m alembic upgrade head`, then run `uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8000`.
- Verify `/api/health`, `/api/session`, `/api/state` through Vite.

## Task 3: Repair transfer and ledger integration

- Modify `src/state/useBackendBank.js`, transfer form/hook, App wiring and confirmation overlays.
- Preserve an idempotency key when requests are uncertain. Keep pending confirmation open until successful execution, do not call local transfer mutations in backend mode, and display server errors/terminal states correctly.
- Verify both product and assistant transfer entry points; backend calls must survive refresh and retries without duplicate debit.

## Task 4: Validate and document

- Add `tests/backend-integration.mjs` exercising isolated browser sessions, server balances/transactions, transfers and existing payment/savings APIs; check persistence on reload and session isolation.
- Run backend pytest against its existing disposable test schema, relevant frontend tests and production build.
- Update `README.md`, `backend/README.md`, `doc/ARCHITECTURE.md`, `doc/CHANGELOG.md`, and `doc/DESIGN.md` with actual startup commands and supported persistence boundaries.
- Add a repeatable local startup script if needed. Do not claim real bank connectivity or Agent completion.
