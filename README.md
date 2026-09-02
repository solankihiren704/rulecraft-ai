# RuleCraft AI

**AI-Powered Academic Regulation Builder, Rule Engine & Student Eligibility
Management System**

RuleCraft AI lets university administrators define academic regulations —
attendance, passing criteria, grading, promotion, backlog/ATKT, grace
marks — as structured, versioned, database-driven rules instead of
hardcoded logic, then evaluates real students against those rules through a
deterministic backend rule engine. An AI layer (Google Gemini) helps admins
author rules in plain English, explains eligibility results to students,
summarizes regulations, and flags likely rule conflicts — but it never
makes the actual eligibility decision; that always comes from the rule
engine.

> **Status:** Auth, Regulations, Rules, Simulator, Students, Users, Reports,
> and Dashboard are built end-to-end — real PostgreSQL data, real
> role-based authorization, no mock data in any of those modules. The AI
> Assistant page is a **preview only** (no Gemini backend is wired up yet —
> see [AI configuration](#ai-configuration)), and there's no Notifications
> module (the `Notification`/`AuditLog` tables exist in the schema but
> nothing currently writes to them). Production-readiness hardening
> (Docker fixes, CI, lint, a real security review) is done — see
> [Production readiness](#production-readiness) below and
> [`docs/architecture/roadmap.md`](docs/architecture/roadmap.md) for the
> module-by-module detail.

## Table of contents

- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [Database setup](#database-setup)
- [Testing](#testing)
- [Docker](#docker)
- [Demo accounts](#demo-accounts)
- [AI configuration](#ai-configuration)
- [Production readiness](#production-readiness)
- [Troubleshooting](#troubleshooting)

## Technology stack

| Layer | Choices |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Axios, React Hook Form + Zod, Recharts, Lucide icons |
| Backend | Node.js 22, Express, TypeScript, JWT auth, Zod validation |
| Database | PostgreSQL via Prisma ORM (7, driver-adapter mode via `@prisma/adapter-pg`) |
| AI | Google Gemini — **not implemented yet**; `/api/ai` doesn't exist, the AI Assistant page is a UI preview with scripted example replies |
| Reports | PDFKit (PDF) and ExcelJS (Excel), both real — `/api/reports` generates and stores actual files |
| Testing | Vitest + Testing Library (frontend), Vitest + Supertest (backend); Playwright is installed for ad-hoc E2E checks but has no committed test suite |

## Architecture

```text
rulecraft-ai/
├── frontend/     React + Vite SPA — talks to the backend only over REST (/api)
├── backend/      Express API — auth, rule engine, AI abstraction, reports
├── docs/         docs/architecture/roadmap.md has real module status; api/, database/, diagrams/ are still empty
├── docker-compose.yml
└── .env.example
```

The backend is the single source of truth for academic decisions: no
attendance/passing/promotion thresholds are hardcoded in controllers or in
the frontend. They live in the database as **rules** evaluated by a generic
rule engine (`backend/src/rule-engine`), so an administrator can change
"75%" to "70%" from the UI with zero code changes.

## Requirements

- **Node.js** 20 or later (built and tested on Node 22)
- **npm** 10 or later
- **PostgreSQL** 14+ (or Docker, see below — you don't need Postgres
  installed locally if you use Docker for just the database)
- A **Google Gemini API key** — not currently used by anything (see
  [AI configuration](#ai-configuration)); no need to get one yet.

## Installation

```bash
git clone <your-repo-url> rulecraft-ai
cd rulecraft-ai
npm install
```

This one command installs both `frontend/` and `backend/` dependencies via
npm workspaces (see the `workspaces` field in the root `package.json`).

## Environment variables

Copy the example files and fill them in:

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
```

Generate strong secrets for the two JWT variables:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that twice — once for `JWT_SECRET`, once for `JWT_REFRESH_SECRET` — and
paste the results into `backend/.env`. Full variable reference:

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `backend/.env` | Yes | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | `backend/.env` | Yes | Access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | `backend/.env` | Yes | Refresh token signing |
| `PORT` | `backend/.env` | No (default `4000`) | Backend port |
| `FRONTEND_URL` | `backend/.env` | No (default `http://localhost:5173`) | Allowed CORS origin |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | `backend/.env` | No | Validated but unused — no AI features read it yet |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `backend/.env` | No | API rate limiting |
| `VITE_API_URL` | `frontend/.env` | No | Only used for production builds; dev uses the Vite proxy |

**Never commit `.env` files.** `.gitignore` already excludes them.

## Running the app

Two terminals, from the repo root:

```bash
# Terminal 1 — backend (http://localhost:4000)
npm run dev:backend

# Terminal 2 — frontend (http://localhost:5173)
npm run dev:frontend
```

Visit `http://localhost:5173` and sign in with one of the
[demo accounts](#demo-accounts) below. Confirm the backend independently
with:

```bash
curl http://localhost:4000/api/health
```

## Database setup

You need a running PostgreSQL instance reachable at the `DATABASE_URL` you
set in `backend/.env`. Easiest option — start just Postgres with Docker:

```bash
docker compose up -d postgres
```

Or point `DATABASE_URL` at any PostgreSQL server you already have. Then, in
`backend/`:

```bash
npm run db:generate   # generates the Prisma client from prisma/schema.prisma
npm run db:migrate     # creates/updates tables from the schema
npm run db:seed        # loads demo data — see prisma/seed.ts (4 departments, 5 programs,
                        # 5 users/roles, 7 students, 4 regulations with rules, a simulation
                        # result, and a few notifications)
```

`schema.prisma` has the full academic data model (departments, programs,
semesters, subjects, students, users, regulations + versions + approval
workflow, rules + conditions, simulation results, reports, notifications,
audit log). To reset your local database during development:

```bash
npm run db:reset
```

This drops and recreates the database, then re-runs migrations and the
seed script — safe for local dev, **never** run it against real data.

## Testing

```bash
# Frontend unit tests (Vitest + Testing Library)
npm run test:frontend

# Backend unit/integration tests (Vitest + Supertest)
npm run test:backend
```

Playwright is installed in `frontend/` for manual/ad-hoc end-to-end
verification against a running dev server, but there is no committed
Playwright test suite yet — `npm run test:frontend` only runs the Vitest
suite above.

Before shipping a change, also verify the production build actually
compiles — the frontend's `tsc --noEmit -p .` (root config) does **not**
catch type errors on its own, because the root `tsconfig.json` only
declares project references with an empty `files` list. Use one of these
instead:

```bash
cd frontend
npx tsc -b          # real type-check across both tsconfig.app.json and tsconfig.node.json
npm run build       # tsc -b, then the production Vite build
```

## Docker

To run everything (Postgres + backend + frontend) in containers:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres: localhost:5432 (user/pass/db: `rulecraft` / `rulecraft` /
  `rulecraft_ai`)

You do not need Docker to develop locally — plain `npm` commands work
too, as shown above.

**Verification status**: Docker itself was not available in the
environment this was hardened in (no `docker`/`docker-compose` binary, no
WSL) — the containers themselves have not been literally built and run.
What *was* verified for real, without Docker, by reproducing the same
topology directly:
- A production Vite build with `VITE_API_URL` set at **build time**,
  served on one port, talking to the backend on a different port
  (genuinely separate origins, same as this compose file creates) — real
  login, CORS, and cross-origin session refresh all confirmed working.
- The compiled backend (`npm run build && node dist/server.js`, not just
  `tsx` dev mode) running and serving real requests correctly.
- The exact sequence `npx prisma migrate deploy && node dist/server.js`
  (now the backend image's `CMD`) run against a freshly dropped and
  recreated database — schema applies cleanly, server starts, login works.

Two real bugs were found this way and fixed:
1. `VITE_API_URL` was declared as a container-runtime `environment:` entry
   for the frontend service — but Vite inlines `import.meta.env.VITE_*`
   into the bundle at **build** time, so a runtime env var had zero effect
   on the already-built files. It's now passed as a `build.args` entry
   instead (see `frontend/Dockerfile` and `docker-compose.yml`).
2. Nothing ever ran `prisma migrate deploy` — the backend `CMD` just
   started the compiled server directly, so a truly fresh deployment would
   have booted against an empty schema and failed on the first query. The
   `CMD` now runs migrations before starting the server. A `HEALTHCHECK`
   was also added (there wasn't one), using Node's built-in `fetch`
   against `/api/health` — deliberately using `process.exitCode`, not
   `process.exit()`, inside the async callback, since the latter triggered
   a real crash in local testing.

Known limitation either way: generated report files are written to
`STORAGE_LOCAL_PATH` (`./storage/reports` by default) with no volume
declared for it in `docker-compose.yml`, so they won't survive a container
recreation — only the `Report` database rows are durable.

## Demo accounts

Seeded by `npm run db:seed`, password **`Demo@1234`** for all of them —
demo-only, never for production use.

| Role | Email | Notes |
|---|---|---|
| Super Admin | `aarav.kulkarni@rulecraft.edu` | Full access to every module |
| Registrar | `neha.iyer@rulecraft.edu` | Same visibility as Super Admin except Users management (view-only there) |
| HOD | `meera.nair@rulecraft.edu` | Scoped to the Computer Science department |
| Faculty | `sanjay.verma@rulecraft.edu` | Scoped to the Electronics department; no manage rights |
| Student | `rajesh.kumar@university.edu` | Sees only their own record/simulations and published regulations |

## AI configuration

**Not implemented yet.** `GEMINI_API_KEY` is validated by `backend/src/config/env.ts`
(so it's safe to set) but nothing currently reads it — there's no `/api/ai`
route, and the AI Assistant page (`frontend/src/features/ai`) is a preview
that returns scripted example replies, clearly labeled in the UI as a
preview with no live model connection. Setting the key today has no
observable effect.

When this does get built, the design intent — worth preserving — is that
AI features (natural-language rule drafting, eligibility explanations,
regulation summaries, conflict-detection assistance) stay strictly
advisory: the deterministic rule engine (`backend/src/rule-engine`) is
always the sole authority for actual eligibility decisions, and the app
must keep working normally with the key unset.

## Production readiness

Status: **READY WITH WARNINGS** — see the full engineering report for the
complete verification log, findings, and reasoning. Re-verified in a
second, independent session (fresh-DB migration test run again from
scratch, every CI job's commands re-run in exact order, a full 5-role
release smoke test — 38/38 checks passed). Summary:

### Not a git repository

No `.git` directory exists anywhere in this project. This blocks pushing
to trigger CI on GitHub's own infrastructure, creating a git tag, or
creating a GitHub release — `git init` (+ an initial commit, + a remote)
is a prerequisite for all three, not done automatically. **RECOMMENDED
NEXT ACTION**: `git init`, commit, add a remote, then push — after which
CI will run for real on GitHub's infrastructure for the first time.

### CI

`.github/workflows/ci.yml` runs on every push/PR to `main`: backend
type-check + lint + test + build (against a real Postgres service
container, migrated with `prisma migrate deploy`), frontend type-check
(`tsc -b`, not the no-op `tsc --noEmit -p .`) + test + build, and a
Docker image build for both Dockerfiles. Not yet run on GitHub's own
infrastructure (see "Not a git repository" above) — every job's commands
have been run locally, in the same order, twice, in two independent
sessions.

### Lint

Backend `npm run lint` was fully broken (`eslint.config.js` didn't exist
— ESLint 10 needs the flat-config format). Set up
`typescript-eslint` + `@eslint/js` + `globals`, added type-aware linting
for `src/**`, and fixed every real issue it found (a genuinely unused
seed-script variable, three stale `eslint-disable` comments predating any
working config, and missing Node globals for the config/scripts files).
`npm run lint` now passes with zero errors and zero warnings. Frontend
`oxlint` was already working; unchanged.

### Security review

Full findings in the engineering report. Headline items:
- **PASS**: authentication (JWT + rotating single-use refresh cookie),
  password hashing (bcrypt, cost 12), CORS (locked to `FRONTEND_URL`,
  verified with a real cross-origin browser test), server-side role
  authorization on every module (not just hidden UI — verified by
  querying APIs directly per role), Zod input validation on every
  endpoint, Prisma/parameterized queries throughout (including the one
  raw SQL query, via `Prisma.sql` tagged templates), production error
  responses correctly suppress internal details.
- **WARNING**: `npm audit` reports 6 vulnerabilities. Classified by actual
  reachability, not just severity label:
  - `deepmerge-ts` (high) / `@prisma/config` (high) / `mysql2` (high) —
    all transitive dependencies of the `prisma` CLI's own tooling.
    Confirmed by grepping the *compiled* backend output: neither
    `deepmerge-ts` nor `mysql2` appears anywhere in `dist/`. Not reachable
    by the running server at all — only a theoretical concern if the
    `prisma` CLI itself were ever pointed at untrusted config input, which
    never happens (it only ever processes this project's own
    `schema.prisma`/`prisma.config.ts`).
  - `uuid` (moderate) / `exceljs` (moderate) — `exceljs` (used for real,
    in Reports' Excel generation) only calls `uuid.v4()` with no
    arguments. The advisory is specifically about a missing bounds check
    when a `buf` option is explicitly passed to v3/v5/v6 — confirmed via
    `grep` that exceljs's only `uuid` import is the unaffected v4 call
    with no buffer argument. Not reachable.
  - The automated fix (`npm audit fix --force`) would force a Prisma
    major-version *downgrade* (7→6) to resolve these — a bigger, riskier
    change than the (already-near-zero) actual risk warrants. Not applied.
- **NEEDS FIX** (fixed): the `VITE_API_URL` build-time-vs-runtime bug and
  the missing migration-on-startup step (both under Docker above), and the
  `JWT_SECRET`/`JWT_REFRESH_SECRET` validation floor (was 16 characters,
  below common HS256 guidance — raised to 32; confirmed backward-compatible
  since the documented generation command produces 96-char secrets and the
  actual dev/CI secrets already clear 32).

### Exact deployment steps (fresh environment)

```bash
# 1. Install
npm install   # or npm ci in CI/CD

# 2. Configure
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env: set DATABASE_URL to your real Postgres, generate
# JWT_SECRET/JWT_REFRESH_SECRET, set FRONTEND_URL to your real frontend origin

# 3. Database
cd backend
npx prisma generate
npx prisma migrate deploy   # NOT `migrate dev` — that's dev-only
npm run db:seed             # optional — demo data only, skip for real prod data

# 4. Build
npm run build                # backend: tsc + tsc-alias
cd ../frontend
VITE_API_URL="https://your-backend-origin/api" npm run build   # must be set at BUILD time

# 5. Run
cd ../backend && npm run start     # node dist/server.js
# serve frontend/dist/ via any static host, pointed at the backend origin above
```

Or via Docker (topology only statically verified — see the Docker
section's verification note above):

```bash
docker compose up --build
```

## Troubleshooting

**`npm install` fails / very slow** — make sure you're on Node 20+
(`node -v`) and try again; corporate proxies/VPNs sometimes interfere with
npm's registry.

**Backend fails to start with "Invalid environment variables"** — you're
missing or have a malformed `backend/.env`. Re-copy from `.env.example` and
check `JWT_SECRET`/`JWT_REFRESH_SECRET` are at least 32 characters.

**`prisma generate` / `prisma migrate` hang or fail to download** — Prisma
downloads a small engine binary on first use in a given environment; this
needs normal outbound internet access (it will not work behind a fully
locked-down firewall/proxy without an allowlist for Prisma's domains).

**Port already in use** — change `PORT` in `backend/.env` (backend) or run
`npm run dev:frontend -- --port 5174` (frontend), and update
`FRONTEND_URL`/CORS accordingly.

**CORS errors in the browser console** — confirm `FRONTEND_URL` in
`backend/.env` exactly matches the URL you're loading the frontend from
(including port).
