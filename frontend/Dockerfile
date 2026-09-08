# RuleCraft AI frontend — dev-friendly image (served via Vite preview)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
# npm ci, not npm install — deterministic, matches CI, and avoids a real
# npm CLI bug (arborist "Cannot read properties of null (reading
# 'edgesOut')") that npm install hit in the backend's equivalent build step.
RUN npm ci
COPY . .
# Vite bakes import.meta.env.VITE_* values into the bundle at BUILD time —
# a container-runtime `environment:` entry in docker-compose.yml has no
# effect on an already-built bundle. Must be passed as a build arg instead
# (see docker-compose.yml's frontend.build.args).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
