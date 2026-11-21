# FlareSolverr health diagnostics

## What the pinned source actually measures

The catalog pins v3.5.2, commit
`93125d6ea6956906c8dfa29e169b2dc67d993dc3`. In that revision:

- [`health_endpoint`](https://github.com/FlareSolverr/FlareSolverr/blob/93125d6ea6956906c8dfa29e169b2dc67d993dc3/src/flaresolverr_service.py#L91-L94)
  returns `status: ok` without starting or querying a browser. `/health` is an
  API-process check, not proof of browser functionality.
- [`_evil_logic`](https://github.com/FlareSolverr/FlareSolverr/blob/93125d6ea6956906c8dfa29e169b2dc67d993dc3/src/flaresolverr_service.py#L472-L485)
  sets `solution.status = 200` unconditionally. API `status: ok` plus solution
  status 200 does **not** prove the target returned HTTP 200. An unrecognized
  upstream error page can pass both checks.
- Each request without a session creates and destroys a WebDriver. Periodic
  synthetic solves are not free; overlapping probes add browser work.

`tests/flaresolverr.sh` now also requires the expected Example Domain title.
The validator regression tests reject explicit failed solution statuses and
error/challenge pages with synthetic status 200. This improves the candidate
contract, not upstream HTTP-status reporting. The external example.com contract
still depends on DNS, egress, TLS and that site's availability.

## Separate the failure domains

A timeout against one public diagnostic target while other requests
succeed is evidence against treating that single target as browser liveness.
It is not proof that the browser can never fail. Collect timestamps, target URL,
request timeout, elapsed time, concurrent requests, container restarts and
browser errors before deciding to restart or change image versions.

Use `/health` for inexpensive process reachability. Treat external synthetic
requests as diagnostics/monitoring, not automatic restart evidence on their own.
Do not run overlapping synthetic solves; bound client timeouts and allow for
browser creation/cleanup outside the solve timer. Avoid declaring a short
orchestrator timeout a browser failure while its request is still running.

## Offline browser check: proposed acceptance criteria, not a shipped endpoint

No browser-health endpoint is added here. A future check should use a controlled
loopback HTTP fixture rather than a public website:

1. Serve a tiny HTML page on a dedicated local listener reachable by Chromium.
   Have JavaScript add a distinctive DOM marker after load.
2. Exercise the normal `request.get` path without a persistent session. Verify
   the expected final URL and rendered marker, not just either status field.
3. Include fixture 503 and wrong-content cases to ensure an upstream-style
   synthetic 200 cannot make the checker pass.
4. Serialize/cache browser checks, cap their frequency, and enforce an overall
   deadline that covers startup and cleanup. Verify no drivers leak on timeout.
5. Test with external egress unavailable and with browser startup deliberately
   broken. A local fixture must succeed in the first case and fail in the second.

A `data:` or `about:blank` navigation alone avoids networking but does not test
HTTP navigation or status semantics. A local HTTP fixture isolates public-site
availability, but still cannot prove DNS, TLS, egress or challenge-solving
success. Keep those as separate diagnostics. A new runtime endpoint needs native
amd64/arm64 image tests before deployment; unit tests alone are insufficient.
