#!/usr/bin/env bash
set -euo pipefail
: "${IMAGE:?IMAGE must identify the locally built image}"
: "${TIMEOUT_SECONDS:=300}"
name="evergreen-homepage-${RANDOM}"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run --detach --name "$name" --network host \
  --security-opt no-new-privileges -e HOMEPAGE_ALLOWED_HOSTS=127.0.0.1:3000 "$IMAGE" >/dev/null
deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl --fail --silent http://127.0.0.1:3000/api/healthcheck >/dev/null; do
  if (( SECONDS >= deadline )) || [[ "$(docker inspect --format '{{.State.Running}}' "$name")" != true ]]; then
    docker logs "$name"; exit 1
  fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:3000/ >/dev/null
docker exec "$name" node -e 'if (require("next/package.json").version !== "16.3.6") process.exit(1)'
echo 'Homepage health, page and patched Next.js contract passed'
