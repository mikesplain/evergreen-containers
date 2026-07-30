import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function report(count) {
  return {
    matches: Array.from({ length: count }, (_, index) => ({
      vulnerability: {
        id: `CVE-2026-${String(index).padStart(4, "0")}`,
        severity: index % 2 === 0 ? "High" : "Critical",
        fix: { state: "fixed", versions: ["2.0.0"] }
      },
      artifact: {
        name: `package-${index}`,
        version: "1.0.0",
        type: "deb"
      }
    }))
  };
}

function evaluate(upstreamCount, candidateCount, maximum) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "evergreen-scan-"));
  const upstream = path.join(directory, "upstream.json");
  const candidate = path.join(directory, "candidate.json");
  fs.writeFileSync(upstream, JSON.stringify(report(upstreamCount)));
  fs.writeFileSync(candidate, JSON.stringify(report(candidateCount)));

  const result = spawnSync(
    process.execPath,
    [
      "scripts/evaluate-scan.mjs",
      "--upstream",
      upstream,
      "--candidate",
      candidate,
      "--maximum",
      String(maximum),
      "--require-no-regression",
      "true"
    ],
    { encoding: "utf8" }
  );

  fs.rmSync(directory, { recursive: true });
  return result;
}

function evaluatePublished(candidateCount, maximum) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "evergreen-published-scan-"));
  const candidate = path.join(directory, "candidate.json");
  fs.writeFileSync(candidate, JSON.stringify(report(candidateCount)));

  const result = spawnSync(
    process.execPath,
    [
      "scripts/evaluate-scan.mjs",
      "--candidate",
      candidate,
      "--maximum",
      String(maximum),
      "--require-no-regression",
      "false"
    ],
    { encoding: "utf8" }
  );

  fs.rmSync(directory, { recursive: true });
  return result;
}

test("scan policy accepts an improved candidate under budget", () => {
  const result = evaluate(4, 2, 3);
  assert.equal(result.status, 0, result.stderr);
});

test("scan policy rejects a regression", () => {
  const result = evaluate(2, 3, 4);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /regressed/);
});

test("scan policy rejects a candidate above budget", () => {
  const result = evaluate(4, 3, 2);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /above reviewed maximum/);
});

test("scan policy can enforce the budget on a published digest", () => {
  const result = evaluatePublished(2, 2);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).upstreamFixableHighCritical, null);
});

test("scan policy requires upstream evidence for regression checks", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "evergreen-published-scan-"));
  const candidate = path.join(directory, "candidate.json");
  fs.writeFileSync(candidate, JSON.stringify(report(1)));
  const result = spawnSync(
    process.execPath,
    [
      "scripts/evaluate-scan.mjs",
      "--candidate",
      candidate,
      "--maximum",
      "1",
      "--require-no-regression",
      "true"
    ],
    { encoding: "utf8" }
  );
  fs.rmSync(directory, { recursive: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /upstream report is required/);
});
