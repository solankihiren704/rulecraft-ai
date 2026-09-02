# RuleCraft AI backend — production image
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npm run db:generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
RUN npm run db:generate
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
