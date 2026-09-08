# RuleCraft AI backend — production image
#
# Build context is the MONOREPO ROOT (see docker-compose.yml and
# .github/workflows/ci.yml — both pass `.` with `dockerfile: backend/
# Dockerfile`), not this backend/ directory. npm workspaces keeps a single
# package-lock.json at the repo root; `npm ci` refuses to run without one
# in its cwd, and a `context: ./backend` build (the previous setup) never
# had access to it, so every `npm ci` here failed with EUSAGE ("no
# package-lock.json") — found via CI actually building this image on
# GitHub's infrastructure, where every run since this file's introduction
# had been failing silently (the Docker verification job is independent of
# the backend/frontend type-check+test+build jobs, so it never blocked a
# merge, just never actually verified the image built).
#
# `prisma generate` only reads schema.prisma and emits client code — it
# never opens a connection — but prisma.config.ts (Prisma 7's config
# system) resolves DATABASE_URL eagerly via env(), for every CLI command
# including `generate`, before it even gets that far. Real credentials are
# never baked into the image (docker-compose.yml supplies the real
# DATABASE_URL at container *runtime*, via `environment:`) — `docker build`
# never sees that. Both `db:generate` calls below are BUILD steps, so each
# needs its own placeholder value, just to satisfy that eager resolution;
# nothing ever connects to it.
FROM node:22-alpine AS build
WORKDIR /app
# ARG, not ENV — build-stage-only, discarded with this whole stage; never
# risks shadowing the real DATABASE_URL docker-compose sets at runtime.
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
# `npm ci` validates the lockfile against every workspace's package.json,
# even ones this image doesn't ship — frontend/package.json has to be here
# too, or npm errors that a workspace listed in the lockfile is missing.
COPY package*.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY backend/prisma ./backend/prisma
# npm ci, not npm install: deterministic (installs exactly what's in
# package-lock.json, no resolution step) and matches what CI's own
# backend/frontend jobs already use. `npm install` here was hitting a real,
# documented npm CLI bug (arborist dependency-graph builder throwing
# "Cannot read properties of null (reading 'edgesOut')") inside this exact
# build step — npm ci takes a different, more direct install codepath that
# doesn't trigger it.
RUN npm ci
COPY backend ./backend
RUN npm run db:generate --workspace=backend && npm run build --workspace=backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Same reasoning as above — ARG here specifically (not ENV) so this
# placeholder never persists into the shipped image's runtime environment
# and can't shadow the real DATABASE_URL docker-compose provides when the
# container actually starts.
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
COPY package*.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./backend/dist
RUN npm run db:generate --workspace=backend
# Everything below runs relative to the backend workspace, exactly as it
# did when this image's build context was ./backend directly.
WORKDIR /app/backend
EXPOSE 4000
# node:22-alpine ships a global fetch — no need to apk add curl just for
# this. Uses process.exitCode (not process.exit()) inside the async
# callback — calling process.exit() there triggered a real libuv assertion
# crash in local testing (a Node/Windows race tearing down the fetch
# handle); exitCode lets the process exit naturally once the event loop
# drains, which is the documented-safe pattern.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "(async () => { try { const r = await fetch('http://localhost:4000/api/health'); process.exitCode = r.ok ? 0 : 1; } catch { process.exitCode = 1; } })();"
# `prisma` (the CLI) is a regular dependency (not dev-only), so it survives
# the --omit=dev install above and is available here. Applying pending
# migrations on every container start is what makes `docker compose up`
# work against a genuinely fresh database with zero manual steps — without
# this, the server would start against an empty schema and every query
# would fail. `migrate deploy` is the non-interactive, production-safe
# command (applies existing migrations only, never generates new ones).
CMD npx prisma migrate deploy && node dist/server.js
