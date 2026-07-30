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
local Dockerfile.

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
