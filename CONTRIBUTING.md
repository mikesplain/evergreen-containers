# Contributing

Contributions are welcome when they preserve the project's narrow purpose:
security-refreshing stable, verifiable upstream container images.

## Proposing an image

Open an issue with:

- the official upstream image and source repository;
- the exact version, image digest, and source commit;
- current fixable High/Critical counts by package type;
- why an official update or replacement is not the better solution;
- supported platforms;
- redistribution license;
- a stable automated contract test;
- a proposed owner and vulnerability budget.

Accepted images add one entry to `catalog/images.json` and one test under
`tests/`. Exact-source rebuilds use the upstream Dockerfile and should not add a
local Dockerfile. Catalog entries may pass versioned build arguments, overlay
reviewed files from `overlays/<image>/`, or apply small reviewed patches under
`patches/<image>/` when stale packaging inputs cannot be overridden upstream.
Overlays keep generated dependency locks deterministic without forking the
upstream Dockerfile. These changes must not alter the application's functional
scope and must remain suitable for upstream contribution.

Every catalog entry must declare its expected base distribution in the `base`
section (`distribution`, `version`, `reviewedAt`). The release workflow reads
`/etc/os-release` from the built image and fails if the detected base does not
match. If the base is in an end-of-life state, an `exception` object with an
owner, evidence, migration issue, and expiry date is required — see
`docs/security-model.md` for details.

New entries start with `release.enabled: false` and a concrete
`release.blockedReason`. Pull requests still build, contract-test, and scan
release-disabled candidates on every declared platform. Enable publication only
after that evidence is reviewed; disabled candidates are excluded from weekly
release verification and publication so they cannot block active images.

## Local validation

```sh
node scripts/validate-catalog.mjs
node --test
```

Container builds and release publication run on GitHub-hosted runners. Local
Docker is optional.

## Pull requests

- Keep upstream application changes separate from packaging refreshes.
- Pin source commits and GitHub Actions to full SHAs.
- Do not add mutable deployment tags.
- Explain any vulnerability-budget increase.
- Preserve upstream licenses and notices.
