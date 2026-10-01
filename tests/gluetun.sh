#!/usr/bin/env bash
set -euo pipefail
: "${IMAGE:?IMAGE must identify the locally built image}"
# Offline CLI and VPN-tool compatibility only; real provider credentials, TUN
# routing and kill-switch behavior require staging, not the production cluster.
docker run --rm --network none "$IMAGE" genkey >/dev/null
version25=$(docker run --rm --network none --entrypoint /usr/sbin/openvpn2.5 "$IMAGE" --version)
grep -q 'OpenVPN 2.5' <<< "$version25"
version26=$(docker run --rm --network none --entrypoint /usr/sbin/openvpn2.6 "$IMAGE" --version)
grep -q 'OpenVPN 2.6' <<< "$version26"
docker run --rm --network none --entrypoint iptables "$IMAGE" --version
echo 'Gluetun offline CLI and VPN-tool contract passed'
