# Evergreen Containers

[![Catalog validation](https://github.com/mikesplain/evergreen-containers/actions/workflows/validate.yml/badge.svg)](https://github.com/mikesplain/evergreen-containers/actions/workflows/validate.yml)
[![Weekly releases](https://github.com/mikesplain/evergreen-containers/actions/workflows/release.yml/badge.svg)](https://github.com/mikesplain/evergreen-containers/actions/workflows/release.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/mikesplain/evergreen-containers/badge)](https://scorecard.dev/viewer/?uri=github.com/mikesplain/evergreen-containers)
[![License](https://img.shields.io/github/license/mikesplain/evergreen-containers)](LICENSE)

Continuously refreshed, scanned, and attested builds of stable upstream
container images.

Evergreen Containers keeps application source stable while refreshing the
packaging around it. It is intended for useful upstream projects whose
container release cadence leaves fixable operating-system vulnerabilities
behind.

## Why

A stable application release can remain operational for years while its
container accumulates known vulnerabilities. Consumers are then forced to
choose between old packages, an unrelated source fork, or maintaining a full
downstream image.

Evergreen Containers provides a smaller fourth option:

1. pin the exact upstream source commit or image digest;
2. rebuild or patch it on public GitHub-hosted runners;
3. test the resulting application contract;
4. compare upstream and candidate vulnerability reports;
5. publish a uniquely tagged multi-platform image;
6. scan every published platform by the exact registry digest;
7. attest the digest only after the publication scan passes.

This project does not claim that a low CVE count makes an image secure. It
preserves runtime hardening, least privilege, network isolation, and prompt
upstream upgrades as separate responsibilities.

## Catalog

| Image | Mode | Upstream | Platforms | Status |
| --- | --- | --- | --- | --- |
| Flaresolverr | Exact-source rebuild | [`v3.5.0`](https://github.com/FlareSolverr/FlareSolverr/releases/tag/v3.5.0) | `linux/amd64`, `linux/arm64` | [Verified: 12 High, 0 Critical](https://github.com/mikesplain/evergreen-containers/actions/runs/30560406686) |
| democratic-csi | Exact-source rebuild | [`v1.9.5`](https://github.com/democratic-csi/democratic-csi/tree/v1.9.5) | `linux/amd64`, `linux/arm64` | [Verified: 9 High, 0 Critical](https://github.com/mikesplain/evergreen-containers/actions/runs/30582663319) |
| Sockpuppet Browser | Exact-source rebuild | [`0.0.3`](https://github.com/dgtlmoon/sockpuppetbrowser/releases/tag/0.0.3) | `linux/amd64`, `linux/arm64` | Maintained Chromium candidate validation |

Catalog entries live in [`catalog/images.json`](catalog/images.json). The
automation implements pinned-source rebuilds using the upstream project's
Dockerfile. Reviewed catalog build arguments, file overlays, and source patches
may refresh packaging dependencies without carrying a downstream Dockerfile. A
Dockerfile-free OS-package patch mode based on
[Copacetic](https://project-copacetic.github.io/copacetic/) is planned after
the first image proves the release model.

Flaresolverr's upstream Dockerfile currently uses a Debian 12 base that Grype
reports beyond its standard-support lifecycle boundary. Weekly rebuilds reduce
available package risk but are an interim control; [issue #7](https://github.com/mikesplain/evergreen-containers/issues/7)
tracks lifecycle enforcement and migration to a supported base.

Sockpuppet Browser's current upstream Dockerfile pins
`zenika/alpine-chrome:119-with-playwright`. Candidate automation measures and
tests that exact source, but the image must not be promoted for consumption
until its Chromium base is updated and the resulting vulnerability budget is
reviewed.

## Release model

- Weekly releases run from protected `main`; maintainers can also dispatch one
  manually.
- Pull requests that change catalog, workflow, script, or test inputs run the
  same native candidate builds, contract tests, and vulnerability comparison
  without package or attestation write permissions.
- Application source is pinned to a full upstream commit. Weekly jobs do not
  silently adopt new application code.
- Base images and package repositories are refreshed with BuildKit
  `pull` and no-cache builds.
- Each supported platform is built, smoke-tested, and scanned independently on
  native GitHub-hosted architecture runners when available.
- A candidate must not regress its upstream image and must remain within its
  reviewed fixable High/Critical budget.
- Every supported platform is scanned again from GHCR by the exact published
  digest. The release workflow cannot attest a digest that exceeds its reviewed
  budget.
- Published tags are unique and include the upstream version, UTC date, Actions
  run number, and run attempt, for example `v3.5.0-r20260730.42.1`.
- Multi-platform images include BuildKit SBOM and SLSA provenance attestations,
  plus GitHub artifact provenance tied to the publishing workflow.
- Consumers should deploy by digest or accept updates through a reviewed
  dependency-automation pull request.

Images are published from this repository to GitHub Container Registry under
the `mikesplain` namespace. The exact pull reference and digest are included in
each successful workflow summary.

The normal lifecycle is 100% GitHub Actions automation: scheduled rebuild,
contract tests, vulnerability comparison, publication, exact-digest scan,
attestation, and evidence retention. It does not require a maintainer
workstation, private runner, or locally installed container engine.

## Trust and verification

Verify GitHub provenance before consuming an image:

```sh
gh attestation verify \
  oci://ghcr.io/mikesplain/evergreen-containers/flaresolverr@sha256:... \
  --repo mikesplain/evergreen-containers
```

Then pin the verified digest in the deployment:

```text
ghcr.io/mikesplain/evergreen-containers/flaresolverr@sha256:...
```

See [`docs/security-model.md`](docs/security-model.md) for the trust boundary,
threat model, and release guarantees.

## Adding an image

Evergreen Containers is deliberately selective. Before proposing an image,
confirm that:

- the upstream project and source are verifiable;
- updating to a newer official release is not the better answer;
- the current problem is primarily stale fixable OS packages;
- a stable functional contract can be tested automatically;
- the upstream license permits redistribution;
- someone accepts ownership of compatibility and exception review.

Add a catalog entry and contract test as described in
[`CONTRIBUTING.md`](CONTRIBUTING.md). Most images should not require a local
Dockerfile.

## Non-goals

- Mirroring images only for availability or convenience.
- Forking actively maintained applications instead of updating them.
- Automatically rewriting compiled application dependencies.
- Publishing `latest` tags.
- Suppressing vulnerabilities solely to make a badge green.
- Treating rebuilt images as a substitute for runtime containment.

## License

The automation in this repository is licensed under the
[Apache License 2.0](LICENSE). Rebuilt images retain their upstream projects'
licenses and notices.
