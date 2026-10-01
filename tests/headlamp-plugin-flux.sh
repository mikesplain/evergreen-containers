#!/usr/bin/env bash
set -euo pipefail
: "${IMAGE:?IMAGE must identify the locally built image}"
# Exercise the exact init-container copy/chown contract used by home-flux.
docker run --rm --network none --user 0 --entrypoint sh "$IMAGE" -ec '
  mkdir -p /build/plugins
  cp -r /plugins/* /build/plugins/
  chown -R 100:101 /build
  test -s /build/plugins/flux/main.js
  test -s /build/plugins/flux/package.json
'
echo 'Headlamp Flux plugin copy contract passed'
