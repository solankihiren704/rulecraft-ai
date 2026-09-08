# RuleCraft AI frontend — dev-friendly image (served via Vite preview)
#
# Build context is the MONOREPO ROOT (see docker-compose.yml and
# .github/workflows/ci.yml — both pass `.` with `dockerfile: frontend/
# Dockerfile`), not this frontend/ directory — npm workspaces keeps a
# single package-lock.json at the repo root, and `npm ci` needs it in its
# cwd. See backend/Dockerfile's header comment for the full story.
FROM node:22-alpine
WORKDIR /app
# `npm ci` validates the lockfile against every workspace's package.json,
# even ones this image doesn't ship — backend/package.json has to be here
# too, or npm errors that a workspace listed in the lockfile is missing.
COPY package*.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
# npm ci, not npm install — deterministic, matches CI, and avoids a real
# npm CLI bug (arborist "Cannot read properties of null (reading
# 'edgesOut')") that npm install hit in the backend's equivalent build step.
RUN npm ci
COPY frontend ./frontend
# Vite bakes import.meta.env.VITE_* values into the bundle at BUILD time —
# a container-runtime `environment:` entry in docker-compose.yml has no
# effect on an already-built bundle. Must be passed as a build arg instead
# (see docker-compose.yml's frontend.build.args).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=frontend
WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
