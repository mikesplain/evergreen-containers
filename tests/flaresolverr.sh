#!/usr/bin/env bash

set -euo pipefail

: "${IMAGE:?IMAGE must identify the locally built image}"
: "${TIMEOUT_SECONDS:=240}"

container_name="evergreen-flaresolverr-${RANDOM}"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run \
  --detach \
  --name "$container_name" \
  --network host \
  --security-opt no-new-privileges \
  "$IMAGE" >/dev/null

deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl --fail --silent --show-error http://127.0.0.1:8191/health >/dev/null 2>&1; do
  if ! docker inspect --format '{{.State.Running}}' "$container_name" | grep -qx true; then
    docker logs "$container_name"
    echo "Flaresolverr exited before becoming healthy."
    exit 1
  fi
  if (( SECONDS >= deadline )); then
    docker logs "$container_name"
    echo "Timed out waiting for Flaresolverr health endpoint."
    exit 1
  fi
  sleep 2
done

response=$(
  curl \
    --fail \
    --silent \
    --show-error \
    --max-time "$TIMEOUT_SECONDS" \
    --header "Content-Type: application/json" \
    --data '{"cmd":"request.get","url":"https://example.com/","maxTimeout":120000}' \
    http://127.0.0.1:8191/v1
)

RESPONSE="$response" node -e '
  const response = JSON.parse(process.env.RESPONSE);
  if (response.status !== "ok" || response.solution?.status !== 200) {
    console.error(response);
    process.exit(1);
  }
  console.log(`Flaresolverr contract passed: ${response.message}`);
'
