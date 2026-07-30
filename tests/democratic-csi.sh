#!/usr/bin/env bash

set -euo pipefail

: "${IMAGE:?IMAGE must identify the locally built image}"
: "${TIMEOUT_SECONDS:=240}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
container_name="evergreen-democratic-csi-${RANDOM}"
socket_volume="${container_name}-socket"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker volume rm "$socket_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker volume create "$socket_volume" >/dev/null
docker run \
  --detach \
  --name "$container_name" \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --mount "type=volume,src=${socket_volume},dst=/csi" \
  --mount "type=bind,src=${script_dir}/fixtures/democratic-csi.yaml,dst=/config/driver.yaml,readonly" \
  "$IMAGE" \
  --driver-config-file /config/driver.yaml \
  --csi-version 1.9.0 \
  --csi-name org.democratic-csi.evergreen-contract \
  --csi-mode controller \
  --server-socket /csi/csi.sock >/dev/null

deadline=$((SECONDS + TIMEOUT_SECONDS))
until docker run \
  --rm \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --mount "type=volume,src=${socket_volume},dst=/csi" \
  --mount "type=bind,src=${script_dir}/democratic-csi-client.cjs,dst=/tmp/contract.cjs,readonly" \
  --entrypoint node \
  "$IMAGE" \
  /tmp/contract.cjs; do
  if ! docker inspect --format '{{.State.Running}}' "$container_name" | grep -qx true; then
    docker logs "$container_name"
    echo "democratic-csi exited before serving the CSI identity contract."
    exit 1
  fi
  if (( SECONDS >= deadline )); then
    docker logs "$container_name"
    echo "Timed out waiting for democratic-csi's identity service."
    exit 1
  fi
  sleep 2
done
