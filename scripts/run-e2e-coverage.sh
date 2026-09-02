#!/usr/bin/env bash

# File location: scripts/run-e2e-coverage.sh
#
# Same as run-e2e.sh, but collects coverage over src/ instead of test/.
# test/jest-e2e.json's rootDir is scoped to test/ itself (needed for its
# moduleNameMapper), so the default coverage collector never reaches src/ —
# jest-e2e.coverage.json is a root-scoped copy of that config that fixes
# collectCoverageFrom instead.
COMPOSE_FILE="docker/test/docker-compose.yml"
ENV_FILE=".env.test"

cleanup() {
  echo "🧹 Cleaning up test container..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v
}
trap cleanup EXIT

echo "🚀 Starting test database container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --wait

echo "⏳ Container is ready! Running E2E tests with coverage..."
dotenv -e "$ENV_FILE" -- jest --config ./jest-e2e.coverage.json --runInBand --coverage
