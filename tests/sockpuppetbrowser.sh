#!/usr/bin/env bash

set -euo pipefail

: "${IMAGE:?IMAGE must identify the locally built image}"
: "${TIMEOUT_SECONDS:=240}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
container_name="evergreen-sockpuppetbrowser-${RANDOM}"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run \
  --detach \
  --name "$container_name" \
  --network host \
  --shm-size 1g \
  --user 1000:1000 \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --mount "type=bind,src=${script_dir}/sockpuppetbrowser-client.py,dst=/tmp/contract.py,readonly" \
  "$IMAGE" >/dev/null

deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl --fail --silent --show-error http://127.0.0.1:8080/stats >/dev/null 2>&1; do
  if ! docker inspect --format '{{.State.Running}}' "$container_name" | grep -qx true; then
    docker logs "$container_name"
    echo "Sockpuppet Browser exited before its statistics endpoint was ready."
    exit 1
  fi
  if (( SECONDS >= deadline )); then
    docker logs "$container_name"
    echo "Timed out waiting for Sockpuppet Browser."
    exit 1
  fi
  sleep 2
done

docker exec "$container_name" /usr/src/app/bin/python3 /tmp/contract.py
