#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    console.error(`Missing required option: ${name}`);
    console.error("Usage: check-base-lifecycle.mjs --distro <name> --version <ver> --image-name <name> [--catalog <path>]");
    process.exit(2);
  }
  return process.argv[index + 1];
}

function optionalOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const detectedDistro = option("--distro").toLowerCase();
const detectedVersionRaw = option("--version");
const imageName = option("--image-name");
const catalogPath = optionalOption("--catalog") ?? path.join(__dirname, "..", "catalog", "images.json");

// Normalize version: "12.6" -> "12", "3.20.1" -> "3.20"
// Debian: major only. Alpine: major.minor.
function normalizeVersion(distro, version) {
  const parts = version.split(".").filter(Boolean);
  if (distro === "alpine") {
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
  }
  // For Debian and others: major only
  return parts[0];
}

const detectedVersion = normalizeVersion(detectedDistro, detectedVersionRaw);

// Load lifecycle reference
const lifecyclePath = path.join(__dirname, "base-lifecycle.json");
const lifecycle = JSON.parse(fs.readFileSync(lifecyclePath, "utf8"));

// Load catalog
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const entry = catalog.images.find((img) => img.name === imageName);
if (!entry) {
  console.error(`Image "${imageName}" not found in catalog`);
  process.exit(1);
}

const expectedDistro = entry.base.distribution;
const expectedVersion = entry.base.version;
const exception = entry.base.exception;

// Build result
const result = {
  detected: { distribution: detectedDistro, version: detectedVersion },
  expected: { distribution: expectedDistro, version: expectedVersion },
  match: detectedDistro === expectedDistro && detectedVersion === expectedVersion,
  status: null,
  eolDate: null,
  exception: null,
  pass: false,
  warnings: []
};

// Check distribution match
if (!result.match) {
  result.warnings.push(
    `Detected base (${detectedDistro} ${detectedVersion}) does not match catalog expectation (${expectedDistro} ${expectedVersion})`
  );
  result.pass = false;
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

// Look up lifecycle
const distroEntry = lifecycle[detectedDistro];
if (!distroEntry) {
  result.warnings.push(`No lifecycle data for distribution "${detectedDistro}"`);
  result.status = "unknown";
  result.pass = false;
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

const versionEntry = distroEntry[detectedVersion];
if (!versionEntry) {
  result.warnings.push(
    `No lifecycle data for ${detectedDistro} ${detectedVersion} (available: ${Object.keys(distroEntry).join(", ")})`
  );
  result.status = "unknown";
  result.pass = false;
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

result.status = versionEntry.status;
result.eolDate = versionEntry.eol ?? null;

// Determine pass/fail
if (result.status === "supported") {
  result.pass = true;
} else if (result.status === "extended-security-maintenance") {
  // ESU is a warning but not a failure by default
  result.pass = true;
  result.warnings.push(`Base ${detectedDistro} ${detectedVersion} is in extended security maintenance until ${result.eolDate}`);
} else {
  // EOL or unknown status that is not "supported"
  if (exception) {
    const today = new Date().toISOString().slice(0, 10);
    if (exception.expires >= today) {
      result.pass = true;
      result.exception = exception;
      result.warnings.push(
        `Base ${detectedDistro} ${detectedVersion} is ${result.status} (EOL: ${result.eolDate}). ` +
        `Exception valid until ${exception.expires} (owner: ${exception.owner}).`
      );
    } else {
      result.pass = false;
      result.exception = exception;
      result.warnings.push(
        `Base ${detectedDistro} ${detectedVersion} is ${result.status} and the exception expired on ${exception.expires}.`
      );
    }
  } else {
    result.pass = false;
    result.warnings.push(
      `Base ${detectedDistro} ${detectedVersion} is ${result.status} (EOL: ${result.eolDate}) and no exception is configured.`
    );
  }
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
