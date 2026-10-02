FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine AS base

ENV TZ=Europe/London
RUN ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime && echo "$TZ" > /etc/timezone

WORKDIR /app
ENV HOME=/home/appuser

# ── All dependencies (for building)
FROM base AS deps
COPY backend/package*.json backend/.npmrc backend/.allowed-scripts.mjs ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --legacy-peer-deps && \
    npx hmpps-npm-script-run-allowlist

# ── Prod-only dependencies
FROM base AS prod-deps
COPY backend/package*.json backend/.npmrc backend/.allowed-scripts.mjs ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --legacy-peer-deps --omit=dev && \
    npx hmpps-npm-script-run-allowlist

# ── Build
FROM deps AS build
ARG BUILD_NUMBER=1_0_0
ARG GIT_REF=not-available
COPY backend/ ./
ENV CI=true
ENV DISABLE_MEDUSA_ADMIN=false
ENV MEDUSA_BACKEND_URL=""
RUN npm run build
RUN ./node_modules/.bin/tsc instrumentation.ts --outDir . --skipLibCheck
RUN echo "{\"buildNumber\":\"${BUILD_NUMBER}\",\"gitRef\":\"${GIT_REF}\"}" > build-info.json

# ── Production
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine-runtime AS production
WORKDIR /app
ENV HOME=/home/appuser

COPY --from=build --chown=appuser:appgroup /app/instrumentation.js ./instrumentation.js
COPY --from=build --chown=appuser:appgroup /app/build-info.json ./build-info.json
COPY --from=build --chown=appuser:appgroup /app/.medusa ./.medusa
COPY --from=build --chown=appuser:appgroup /app/medusa-config.js ./.medusa/server/medusa-config.js
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./.medusa/server/node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./.medusa/server/package.json
COPY --from=build --chown=appuser:appgroup /app/package-lock.json ./.medusa/server/package-lock.json

RUN mkdir -p /home/appuser/.config && \
    chown -R appuser:appgroup /home/appuser /app

USER 2000
ENV NODE_ENV=production
ENV PORT=9000
ENV DISABLE_MEDUSA_TELEMETRY=true
EXPOSE 9000

CMD ["sh", "-c", "cd /app/.medusa/server && node ./node_modules/.bin/medusa db:migrate --execute-safe-links && node ./node_modules/.bin/medusa start"]