# Flaresolverr packaging remediation (#48)

Candidate evidence: [run 37012792026](https://github.com/mikesplain/evergreen-containers/actions/runs/37012792026),
head `02a03dcbf6163f5634b431a2c390dcc09110128e`, upstream source unchanged at
`4ca91a24f87a73f963e1d6610cbf3b9f01c1cc1b`.

Native builds, pip check, installed/vendored metadata checks, bundled driver
imports and browser API contracts passed on linux/amd64 and linux/arm64.
Setuptools 84.0.0 supplies vendored jaraco.context 6.1.0 and wheel 0.46.3;
standalone wheel is also refreshed to 0.46.3. Updating standalone jaraco.context
alone would not remediate the private setuptools copy.

Downloaded candidate JSON reports were inspected (not inferred from the gate):

| Platform | Fixable Critical | Fixable High | Remaining finding | Artifact ID | Candidate JSON SHA-256 |
| --- | --- | --- | --- | --- | --- |
| linux/amd64 | 0 | 1 | Python 3.11.17, CVE-2026-82049 | 11228474417 | `9464b70a4e0b33fc42337fc0c6c18781a0f5a1db1975b56eb942c3272e01212d` |
| linux/arm64 | 0 | 1 | Python 3.11.17, CVE-2026-82049 | 11228163782 | `2dac25cc7dafbd3b61937d161610ee1f1d45e12bf8dbcc8dcdbf7beca8bd54f4` |

Both reports identify the intended architecture. Neither report contains
GHSA-58pv-8j8x-9vj2 or GHSA-8rrh-rw8j-w5fx. The only fixable High/Critical
signature is the Python finding already tracked by #30: no new signature.
Artifacts `scan-flaresolverr-linux-amd64` and `scan-flaresolverr-linux-arm64`
retain upstream, candidate and evaluation JSON for 30 days.

The catalog cap is ratcheted from 153 to the measured per-platform maximum of 1,
with no-regression enforcement retained. This is not risk acceptance of Python;
#30 still owns its migration/advisory/backport validation.

## Still required after merge

This is candidate evidence, **not** evidence of a remediated published release.
Keep #48 open until a release built from the merged change has:

- scans of the exact published index on both explicitly selected platforms,
  the two signatures absent, and no new fixable High/Critical regressions;
- retained published scan artifacts and linked index/release evidence;
- verified GitHub provenance for that exact published index;
- review of the ratchet against those published measurements.

No automatic closure, deployment change, approval or merge is part of this work.
