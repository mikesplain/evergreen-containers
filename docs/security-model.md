# Security Model

Evergreen Containers is a downstream packaging and remediation service. It does
not become the authoritative source for the applications it rebuilds.

## Trust boundary

The project guarantees that a published image:

- was produced by a workflow on this public repository's protected default
  branch;
- used the source repository and full commit recorded in the catalog;
- passed the catalog's platform-specific contract test;
- was scanned by exact registry digest for every published platform;
- did not exceed its reviewed fixable High/Critical budget;
- did not regress relative to the pinned upstream image when that policy is
  enabled;
- carries immutable build metadata, an SBOM, and provenance attestations.

The project does not guarantee that:

- an upstream project, dependency repository, package mirror, or base image is
  free from compromise;
- every scanner finding is exploitable or every vulnerability is detected;
- an image is safe to run without normal Kubernetes or container hardening;
- application-level dependencies are repaired by an unchanged source rebuild.

Catalog-controlled build arguments, file overlays, and source patches are part
of the trusted Evergreen build input. They are stored in this repository,
applied only to a full upstream source commit, and covered by the workflow's
provenance. Paths are constrained to the matching image's `overlays/` or
`patches/` directory. These inputs are reserved for packaging and dependency
remediation; application behavior remains anchored by the upstream source pin
and contract test.

## Workflow separation

Pull-request workflows receive only read permissions. They validate repository
data and tests but cannot publish packages or attestations.

Release jobs run after relevant merges to the protected default branch, on the
weekly schedule, or by manual dispatch. Those jobs receive the minimum
permissions needed to read source, publish packages, request an OIDC identity,
and write attestations.

All third-party actions are pinned to full commit SHAs. Catalog source inputs
are also pinned to full commits or immutable image digests.

## Release identity

Every release uses a unique tag:

```text
<upstream-version>-r<UTC-date>.<actions-run-number>.<run-attempt>
```

Including the run attempt prevents the normal workflow rerun path from
overwriting a previous release tag. There is no `latest` tag. Because registry
tags are mutable references, consumers should verify provenance and deploy the
resulting digest.

## Vulnerability policy

Scans count unique fixable High and Critical matches using the vulnerability,
package, installed version, package type, and fix state. Each catalog entry has
a reviewed maximum and may require that the candidate does not regress against
the upstream image under the same Grype database.

The maximum is a temporary compatibility gate, not an ignore list. It must be
reduced when a release removes findings. Raising it requires review and an
explanation in the pull request.

Native candidate scans catch regressions before publication. The publishing job
then pulls each platform from GHCR by the exact multi-platform digest and
enforces the reviewed maximum again. GitHub provenance is emitted only after
that exact-artifact check succeeds.

## Base distribution policy

Every catalog entry declares the expected base distribution and major version
in its `base` section. The release workflow detects the actual OS from the
built image by reading `/etc/os-release` and compares it against the catalog
declaration. A mismatch fails the build.

The detected distribution and version are checked against a maintained
lifecycle reference (`scripts/base-lifecycle.json`). If the base is in an
unsupported or end-of-life state, publication fails unless a valid exception
is configured in the catalog.

An exception is a temporary, time-limited override that requires:

- `owner` — the person responsible for tracking the migration;
- `reason` — why the EOL base is still in use;
- `evidence` — a link to the scan or CI run that established the baseline;
- `migrationIssue` — a tracking issue for the base migration;
- `expires` — a future date after which the exception no longer applies.

When an exception is active, the workflow logs a warning in the summary but
allows publication to proceed. Once the expiry date passes, the exception
becomes invalid and the gate fails again.

**Refreshed packages vs. supported base migration.** Installing the latest
security patches on an EOL base (e.g., `apt-get update && apt-get upgrade` on
Debian 11) is a temporary risk reduction. It does not extend the base's
lifecycle or restore scanner coverage. A supported base migration means
changing the `FROM` reference to a currently supported release (e.g.,
`debian:12-slim` or `debian:13-slim`). Only the latter resets the lifecycle
clock. Weekly rebuilds with refreshed packages on an EOL base are an interim
measure while the migration issue is resolved.

The lifecycle reference file is hand-curated and updated via pull request.
The `base-image-freshness` workflow inspects upstream base images on a
schedule to flag changes that may require a catalog update.

## Reporting security issues

Do not open a public issue for a suspected compromise, credential exposure, or
unpublished vulnerability. Follow [`SECURITY.md`](../SECURITY.md).
