#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "..", "scripts", "check-base-lifecycle.mjs");
const catalogPath = path.join(__dirname, "..", "catalog", "images.json");
const lifecyclePath = path.join(__dirname, "..", "scripts", "base-lifecycle.json");

let passed = 0;
let failed = 0;

function run(args) {
  try {
    const stdout = execFileSync("node", [script, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

// Save originals before any modifications
const originalCatalog = fs.readFileSync(catalogPath, "utf8");
const originalLifecycle = fs.readFileSync(lifecyclePath, "utf8");

// Restore in exit handler
process.on("exit", () => {
  fs.writeFileSync(catalogPath, originalCatalog);
  fs.writeFileSync(lifecyclePath, originalLifecycle);
});

function withCatalogAndLifecycle(catalogStr, lifecycleStr, fn) {
  fs.writeFileSync(catalogPath, catalogStr);
  fs.writeFileSync(lifecyclePath, lifecycleStr);
  try {
    fn();
  } finally {
    // restored by process exit handler or next withCatalogAndLifecycle
  }
}

// --- Test 1: Supported base (Debian 12) ---
{
  const result = run([
    "--distro", "debian",
    "--version", "12.6",
    "--image-name", "flaresolverr"
  ]);
  assert(result.status === 0, `Test 1: expected exit 0, got ${result.status} — ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.pass === true, "Test 1: should pass");
  assert(parsed.status === "supported", `Test 1: expected status "supported", got ${parsed.status}`);
  assert(parsed.match === true, "Test 1: detected should match expected");
  assert(parsed.detected.version === "12", `Test 1: normalized version should be "12", got ${parsed.detected.version}`);
}

// --- Test 2: Supported base (Debian 13) ---
{
  const result = run([
    "--distro", "debian",
    "--version", "13.0",
    "--image-name", "sockpuppetbrowser"
  ]);
  assert(result.status === 0, `Test 2: expected exit 0, got ${result.status} — ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.pass === true, "Test 2: should pass");
  assert(parsed.status === "supported", `Test 2: expected status "supported", got ${parsed.status}`);
  assert(parsed.detected.version === "13", `Test 2: normalized version should be "13", got ${parsed.detected.version}`);
}

// --- Test 3: Mismatch (wrong distribution) ---
{
  const result = run([
    "--distro", "ubuntu",
    "--version", "24.04",
    "--image-name", "flaresolverr"
  ]);
  assert(result.status === 1, `Test 3: expected exit 1, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.pass === false, "Test 3: should fail");
  assert(parsed.match === false, "Test 3: should not match");
}

// --- Test 4: Mismatch (wrong version) ---
{
  const result = run([
    "--distro", "debian",
    "--version", "11",
    "--image-name", "flaresolverr"
  ]);
  assert(result.status === 1, `Test 4: expected exit 1, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.match === false, "Test 4: should not match (version 11 vs expected 12)");
}

// --- Test 5: Unknown version in lifecycle data ---
{
  const catalog = JSON.parse(originalCatalog);
  catalog.images.push({
    name: "test-unknown",
    base: { distribution: "debian", version: "99", reviewedAt: "2026-08-01" },
  });

  withCatalogAndLifecycle(JSON.stringify(catalog, null, 2), originalLifecycle, () => {
    const result = run([
      "--distro", "debian",
      "--version", "99",
      "--image-name", "test-unknown"
    ]);
    assert(result.status === 1, `Test 5: expected exit 1, got ${result.status} — ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.status === "unknown", `Test 5: expected "unknown", got ${parsed.status}`);
  });
}

// --- Test 6: EOL base with no exception ---
{
  const catalog = JSON.parse(originalCatalog);
  catalog.images.push({
    name: "test-eol",
    base: { distribution: "debian", version: "11", reviewedAt: "2026-08-01" },
  });
  const lifecycle = JSON.parse(originalLifecycle);
  lifecycle.debian["11"] = { status: "eol", eol: "2024-08-31" };

  withCatalogAndLifecycle(JSON.stringify(catalog, null, 2), JSON.stringify(lifecycle, null, 2), () => {
    const result = run([
      "--distro", "debian",
      "--version", "11",
      "--image-name", "test-eol"
    ]);
    assert(result.status === 1, `Test 6: expected exit 1 (EOL no exception), got ${result.status} — ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.pass === false, "Test 6: should fail");
    assert(parsed.status === "eol", `Test 6: expected "eol", got ${parsed.status}`);
  });
}

// --- Test 7: EOL base with valid exception ---
{
  const catalog = JSON.parse(originalCatalog);
  const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  catalog.images.push({
    name: "test-eol-exception",
    base: {
      distribution: "debian",
      version: "11",
      reviewedAt: "2026-08-01",
      exception: {
        owner: "testuser",
        reason: "Testing exception",
        evidence: "https://github.com/mikesplain/evergreen-containers/actions/runs/123",
        migrationIssue: "https://github.com/mikesplain/evergreen-containers/issues/99",
        expires: futureDate
      }
    },
  });
  const lifecycle = JSON.parse(originalLifecycle);
  lifecycle.debian["11"] = { status: "eol", eol: "2024-08-31" };

  withCatalogAndLifecycle(JSON.stringify(catalog, null, 2), JSON.stringify(lifecycle, null, 2), () => {
    const result = run([
      "--distro", "debian",
      "--version", "11",
      "--image-name", "test-eol-exception"
    ]);
    assert(result.status === 0, `Test 7: expected exit 0 (valid exception), got ${result.status} — ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.pass === true, "Test 7: should pass with exception");
    assert(parsed.status === "eol", "Test 7: status should still be eol");
    assert(parsed.exception !== null, "Test 7: exception should be reported");
    assert(parsed.warnings.length > 0, "Test 7: should have warnings");
  });
}

// --- Test 8: Alpine version normalization ---
{
  const catalog = JSON.parse(originalCatalog);
  catalog.images.push({
    name: "test-alpine",
    base: { distribution: "alpine", version: "3.20", reviewedAt: "2026-08-01" },
  });

  withCatalogAndLifecycle(JSON.stringify(catalog, null, 2), originalLifecycle, () => {
    const result = run([
      "--distro", "alpine",
      "--version", "3.20.1",
      "--image-name", "test-alpine"
    ]);
    assert(result.status === 0, `Test 8: expected exit 0, got ${result.status} — ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.detected.version === "3.20", `Test 8: Alpine version should normalize to "3.20", got ${parsed.detected.version}`);
    assert(parsed.match === true, "Test 8: should match");
  });
}

// --- Test 9: Expired exception should fail ---
{
  const catalog = JSON.parse(originalCatalog);
  const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  catalog.images.push({
    name: "test-expired",
    base: {
      distribution: "debian",
      version: "11",
      reviewedAt: "2026-08-01",
      exception: {
        owner: "testuser",
        reason: "Expired test",
        evidence: "https://github.com/mikesplain/evergreen-containers/actions/runs/123",
        migrationIssue: "https://github.com/mikesplain/evergreen-containers/issues/99",
        expires: pastDate
      }
    },
  });
  const lifecycle = JSON.parse(originalLifecycle);
  lifecycle.debian["11"] = { status: "eol", eol: "2024-08-31" };

  withCatalogAndLifecycle(JSON.stringify(catalog, null, 2), JSON.stringify(lifecycle, null, 2), () => {
    const result = run([
      "--distro", "debian",
      "--version", "11",
      "--image-name", "test-expired"
    ]);
    assert(result.status === 1, `Test 9: expected exit 1 (expired exception), got ${result.status} — ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.pass === false, "Test 9: should fail with expired exception");
  });
}

// Restore originals
fs.writeFileSync(catalogPath, originalCatalog);
fs.writeFileSync(lifecyclePath, originalLifecycle);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
