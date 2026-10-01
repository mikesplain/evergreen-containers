# Home Flux image scan remediation (2026-10-01)

Owner: mikesplain. Evidence: [home-flux static scan](https://github.com/mikesplain/home-flux/actions/runs/36928787969).
The scan completed successfully but found new fixable Critical vulnerabilities.
Do not widen the home-flux baseline or the existing Evergreen budgets.

| Image | Remediation | Promotion requirement |
| --- | --- | --- |
| Redis 8.0.6 / Alpine 3.21 | Official Redis 8.2.10-alpine, independently scanned with no fixable findings | Home-flux upgrade PR; minor application upgrade requires Redis compatibility review |
| democratic-csi 1.9.5 | Keep source fixed; upgrade Debian runtime packages and rclone to 1.75.1 | Existing budget of 9 remains enforced; existing grpc/axios PRs are not duplicated |
| notification-controller 1.9.4 | Exact-source rebuild, refresh Alpine 3.23 runtime | New catalog entry stays release-disabled pending scans and staging reconciliation test |
| Homepage 2.4.0 | Exact-source rebuild; lock Next.js 16.3.6; refresh Alpine runtime | Health/page tests, dependency version check, scans and review |
| Headlamp Flux plugin 0.7.0 | Exact-source rebuild using maintained Node builder and Alpine 3.23 | Exercise the deployed plugin copy/chown contract, scans and review |
| Gluetun 3.41.3 | Exact-source rebuild; refresh runtime packages and Go builder | Offline CLI/tool tests and scans; staging VPN/TUN/kill-switch test still required |

New candidates require zero fixable High/Critical findings and no regression.
Build args do not silently upgrade application source. Homepage's package and
lock overlays change only the security packaging inputs; its upstream GPL-3.0
license is retained. Other sources retain their upstream licenses and notices.

## A green workflow was not proof of policy compliance

The democratic-csi amd64 artifact from [run 36868540716](https://github.com/mikesplain/evergreen-containers/actions/runs/36868540716)
contains 36 fixable High/Critical findings against a maximum of 9, while the job
was green. The evaluator correctly returns 1, but `node ... | tee ...` under
Actions' implicit `bash -e` shell returns tee's status. Selecting explicit bash
enables pipefail for candidate policy, lifecycle policy and published-digest
policy. The regression test fails on the original workflow and passes with the
fix. Failure evidence is retained even when a candidate is rejected.

## Deployment sequencing

Never point home-flux at unbuilt or unpublished Evergreen tags. First obtain
native amd64/arm64 build, contract and scan evidence; maintainers then review
publication enablement. After publication, verify attestations and scan the
exact published digest before preparing deployment references. No cluster
changes or merges are part of this work. New candidates are not yet approved
for production; controller and VPN operational behavior need staging tests.
