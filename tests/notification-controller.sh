#!/usr/bin/env bash
set -euo pipefail
: "${IMAGE:?IMAGE must identify the locally built image}"
# No Kubernetes credentials or cluster writes: verify the controller's CLI ABI
# and the upstream unprivileged identity. Reconciliation needs a staging cluster.
help=$(docker run --rm --network none "$IMAGE" --help 2>&1)
for flag in --events-addr --health-addr --metrics-addr --receiverAddr; do
  grep -Fq -- "$flag" <<< "$help"
done
test "$(docker image inspect --format '{{.Config.User}}' "$IMAGE")" = '65534:65534'
echo 'notification-controller CLI and non-root contract passed'
