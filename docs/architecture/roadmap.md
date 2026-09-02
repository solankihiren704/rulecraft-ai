# RuleCraft AI — Module Status & Release Readiness

This project was originally planned as 25 fine-grained phases (see
session history if you need that level of detail). In practice the work
shipped module-by-module, and that's a more useful way to describe current
state than the original phase numbering, which no longer matches how the
codebase is organized.

## COMPLETED

| Module | Backend | Frontend | Notes |
|---|---|---|---|
| Auth | ✅ | ✅ | JWT access + httpOnly refresh cookie, single-use refresh rotation, role-based `req.user` |
| Regulations | ✅ | ✅ | Draft → review → approve/reject → publish workflow, versioning, approval history |
| Rules | ✅ | ✅ | Condition-based rule engine (`backend/src/rule-engine`), scoped to draft regulations |
| Simulator | ✅ | ✅ | Real eligibility runs via the deterministic rule engine, persisted history |
| Students | ✅ | ✅ | Full CRUD, department-scoped visibility for HOD/Faculty, self-scoped for the student role |
| Users | ✅ | ✅ | Account management restricted to Super Admin; view restricted to Super Admin/Registrar |
| Reports | ✅ | ✅ | Real CSV/PDF/Excel generation (PDFKit/ExcelJS) from live aggregate queries, stored server-side |
| Dashboard | ✅ | ✅ | Aggregate KPIs via Prisma `groupBy`, role-scoped (department for HOD/Faculty, self for students) |

Every module above enforces role-based authorization server-side (not just
hidden UI) — verified twice, in independent sessions, with a real browser
against a real backend across all 5 roles (`super_admin`, `registrar`,
`hod`, `faculty`, `student`): 38/38 checks passed in the most recent run
(login, logout, session refresh, all 7 feature pages, invalid-login/
no-token/unknown-route error handling, and per-role authorization
boundaries on Users/Reports/Regulations-management).

Also completed this pass: backend lint pipeline (was fully broken, now
zero errors/warnings), CI workflow (`.github/workflows/ci.yml`, every job's
commands verified locally), a real fresh-database production-migration
test (twice, in two separate sessions), and a security review (see
README's Production readiness section for full findings).

## DEPLOYMENT READY

The non-Docker deployment path is verified end-to-end: `npm ci` → `prisma
migrate deploy` → `npm run db:seed` (optional) → `npm run build` (both
apps, with `VITE_API_URL` set at frontend build time) → `node dist/server.js`
+ serve `frontend/dist/`. Re-confirmed against a **freshly dropped and
recreated** database in two independent sessions, including running the
exact production `CMD` sequence (`prisma migrate deploy && node
dist/server.js`) against a genuinely empty schema.

Docker: `docker-compose.yml` and both Dockerfiles are configured and two
real bugs in them were found and fixed (see Known limitations), but the
containers themselves have never been literally built/run — **Docker is
not installed in the environment this project has been developed and
hardened in** (no `docker` binary, no WSL). Everything Docker would
verify was instead reproduced directly: a production frontend build
served on one port talking to a backend on a different port (genuinely
separate origins, real CORS, real cross-origin session refresh), and the
compiled backend running the exact Docker `CMD` sequence against a fresh
database. See README's [Production readiness](../../README.md#production-readiness)
section for the full log.

**RECOMMENDED: ALLOW/INSTALL** Docker Desktop (+ WSL 2 on Windows) to
close this last gap — see the engineering report for the exact
recommendation.

## KNOWN LIMITATIONS

- **Not a git repository.** No `.git` directory exists anywhere in this
  project. This blocks: pushing to trigger CI on GitHub's own
  infrastructure, creating a git tag, and creating a GitHub release.
  `git init` (+ an initial commit, + adding a remote) is a prerequisite
  for all of those — not attempted without your explicit go-ahead, since
  it's the kind of action that should be a deliberate choice, not an
  autonomous side effect.
- **AI Assistant** — `/api/ai` doesn't exist. The frontend page
  (`frontend/src/features/ai`) is a preview only, clearly labeled in the UI,
  returning scripted example replies. `GEMINI_API_KEY` is validated in
  `backend/src/config/env.ts` but nothing reads it yet.
- **Notifications** — the `Notification` and `AuditLog` Prisma models exist
  and `Notification` has 4 rows from the seed script, but no module writes
  to either table as a side effect of anything happening in the app. The
  Dashboard's "Recent activity" panel deliberately does **not** read from
  `Notification` for this reason — it's built instead from real timestamped
  events already in `ApprovalStep` / `RegulationVersion` / `SimulationResult`.
- **Academic Structure** (Departments/Programs/Semesters/Subjects
  management UI) and **Command Palette**'s page-navigation list are still
  on `frontend/src/services/mockData.ts` for anything beyond what
  Regulations/Rules/Simulator/Students/Reports/Dashboard already needed
  from Departments/Programs (those specific reads — e.g. the program
  picker on the Regulations form — are real). The dedicated
  Academic Structure management page itself was never wired to the real
  `/api/departments`, `/api/programs`, `/api/semesters`, `/api/subjects`
  endpoints, even though those backend routes exist and work.
- No "must change password on first login" flow — a newly created user's
  temporary password (shown once in the Users page) doesn't expire.
- Creating a `student`-role User doesn't link it to a `Student` record —
  that link (`Student.userId`) has no UI anywhere; it's only set by the
  seed script today.
- Attendance/Promotion Outcome reports match simulation results to rules
  **by current rule name**, not a stored rule ID (the schema denormalizes
  `SimulationBreakdownItem.ruleName` as a snapshot) — a renamed or deleted
  rule's historical evaluations won't be counted. Disclosed in every
  generated report's own Notes section, not hidden.
- Docker containers never literally built/run — see DEPLOYMENT READY above.
- Report files are stored on local disk (`STORAGE_LOCAL_PATH`) with no
  volume declared in Docker Compose — they won't survive a container
  recreation, only the database rows will.
- `npm audit` reports 6 vulnerabilities, all transitively via the `prisma`
  CLI's own tooling deps (`deepmerge-ts`, `mysql2` — confirmed absent from
  the actual compiled server output, i.e. never reachable at runtime) or
  `exceljs`'s `uuid` dep (confirmed exceljs only calls `uuid.v4()` with no
  arguments — the vulnerable code path requires an explicit buffer
  argument to v3/v5/v6, never exercised here). The automated fix forces a
  Prisma major-version downgrade (7→6); left as-is.

## FUTURE ENHANCEMENTS

Not blockers, not started — listed for planning, not implied to be next:

- Real AI integration (`/api/ai` + Gemini) behind the existing preview UI
- A real Notifications module that writes rows on real events (approvals,
  publishes, simulation completions), replacing the Dashboard's synthesized
  activity feed
- Academic Structure management page wired to its already-working backend
- A committed Playwright E2E suite (Playwright is installed; every test in
  this project's history so far has been ad-hoc and discarded after use)
- A `student`↔`User` linking UI
- An S3 (or similar) storage driver for Reports, behind the existing
  `STORAGE_DRIVER` abstraction
- A password-expiry / forced-reset flow for admin-created accounts

## Production readiness hardening — process note

Two dedicated passes covered this: an initial hardening session (Docker
config fixes, backend lint setup, CI creation, first security review) and
a follow-up verification session (Phase 1–9 above) that re-ran everything
from a clean state, fixed the JWT secret validation floor, and did a
formal `npm audit` reachability classification. Full detail and exact
commands run are in the engineering reports from those sessions — see
README's Production readiness section for the current summary (kept
intentionally brief here to avoid the two docs drifting out of sync).
