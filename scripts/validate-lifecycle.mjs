#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lifecyclePath = path.join(__dirname, "base-lifecycle.json");
const catalogPath = path.join(__dirname, "..", "catalog", "images.json");

const errors = [];

// Validate lifecycle reference file
let lifecycle;
try {
  lifecycle = JSON.parse(fs.readFileSync(lifecyclePath, "utf8"));
} catch (e) {
  console.error(`Failed to parse base-lifecycle.json: ${e.message}`);
  process.exit(1);
}

const validStatuses = ["supported", "extended-security-maintenance", "eol"];

for (const [distro, versions] of Object.entries(lifecycle)) {
  if (typeof distro !== "string" || distro.trim() === "") {
    errors.push("Lifecycle file contains an empty distribution name");
    continue;
  }
  if (typeof versions !== "object" || versions === null || Array.isArray(versions)) {
    errors.push(`Lifecycle entry for "${distro}" must be an object`);
    continue;
  }
  for (const [version, entry] of Object.entries(versions)) {
    if (typeof entry !== "object" || entry === null) {
      errors.push(`Lifecycle entry ${distro} ${version} must be an object`);
      continue;
    }
    if (!validStatuses.includes(entry.status)) {
      errors.push(`Lifecycle entry ${distro} ${version} has invalid status "${entry.status}" (expected: ${validStatuses.join(", ")})`);
    }
    if (typeof entry.eol !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.eol)) {
      errors.push(`Lifecycle entry ${distro} ${version} must have an ISO 8601 eol date`);
    }
  }
}

// Validate that all catalog base entries are covered by the lifecycle file
try {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  for (const [index, image] of catalog.images.entries()) {
    const base = image.base;
    if (!base) continue; // base validation is in validate-catalog.mjs
    const distroEntry = lifecycle[base.distribution];
    if (!distroEntry) {
      errors.push(`Catalog image "${image.name}" declares base distribution "${base.distribution}" which is not in the lifecycle reference`);
    } else if (!distroEntry[base.version]) {
      errors.push(
        `Catalog image "${image.name}" declares base ${base.distribution} ${base.version} which is not in the lifecycle reference (available: ${Object.keys(distroEntry).join(", ")})`
      );
    }
  }
} catch (e) {
  // Catalog validation errors are reported by validate-catalog.mjs
}

if (errors.length > 0) {
  console.error("Lifecycle reference validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const distroCount = Object.keys(lifecycle).length;
const versionCount = Object.values(lifecycle).reduce((sum, v) => sum + Object.keys(v).length, 0);
console.log(`Lifecycle reference is valid: ${distroCount} distribution(s), ${versionCount} version(s).`);
