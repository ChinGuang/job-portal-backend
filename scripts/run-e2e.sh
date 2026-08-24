#!/usr/bin/env bash

# File location: scripts/run-e2e.sh
COMPOSE_FILE="docker/test/docker-compose.yml"
ENV_FILE=".env.test"

# Teardown logic runs automatically on script exit or error
cleanup() {
  echo "🧹 Cleaning up test container..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v
}
trap cleanup EXIT

echo "🚀 Starting test database container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --wait

echo "⏳ Container is ready! Running E2E tests..."
dotenv -e "$ENV_FILE" -- jest --config ./test/jest-e2e.json --runInBand