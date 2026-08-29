# --- Build Stage ---
FROM node:24-alpine AS builder

RUN corepack enable

WORKDIR /usr/src/app

ENV CI=true

COPY package.json pnpm-lock.yaml ./

# Install dependencies without running lifecycle scripts
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# pnpm 11 re-verifies (and can reinstall) deps before running any script by
# default; deps are already installed above, so skip that check here.
RUN pnpm --config.verify-deps-before-run=false run build

# --- Production Stage ---
FROM node:24-alpine AS runner

RUN corepack enable

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]