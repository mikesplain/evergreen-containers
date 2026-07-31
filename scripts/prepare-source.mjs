#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) {
  console.error("Usage: prepare-source.mjs <source-directory>");
  process.exit(2);
}

function parsePathList(name) {
  let value;
  try {
    value = JSON.parse(process.env[name] ?? "[]");
  } catch {
    console.error(`${name} must be a JSON array`);
    process.exit(2);
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    console.error(`${name} must be a JSON array of paths`);
    process.exit(2);
  }
  return value;
}

const overlays = parsePathList("EVERGREEN_OVERLAYS");
const patches = parsePathList("EVERGREEN_PATCHES");
const repositoryRoot = fs.realpathSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
);
const patchesRoot = fs.realpathSync(path.join(repositoryRoot, "patches")) + path.sep;
const overlaysRoot = fs.realpathSync(path.join(repositoryRoot, "overlays")) + path.sep;
const sourceRoot = fs.realpathSync(source) + path.sep;

for (const patch of patches) {
  let patchPath;
  try {
    patchPath = fs.realpathSync(path.resolve(repositoryRoot, patch));
  } catch {
    console.error(`Patch does not exist: ${patch}`);
    process.exit(2);
  }
  if (!patchPath.startsWith(patchesRoot)) {
    console.error(`Patch escapes the patches directory: ${patch}`);
    process.exit(2);
  }

  for (const args of [["apply", "--check", patchPath], ["apply", patchPath]]) {
    const result = spawnSync("git", args, {
      cwd: source,
      encoding: "utf8",
      stdio: "pipe"
    });
    if (result.status !== 0) {
      process.stderr.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }
  }

  console.log(`Applied ${patch}`);
}

for (const overlay of overlays) {
  let overlayPath;
  try {
    overlayPath = fs.realpathSync(path.resolve(repositoryRoot, overlay));
  } catch {
    console.error(`Overlay does not exist: ${overlay}`);
    process.exit(2);
  }
  if (!overlayPath.startsWith(overlaysRoot)) {
    console.error(`Overlay escapes the overlays directory: ${overlay}`);
    process.exit(2);
  }

  const relativeDestination = overlay.split("/").slice(2).join("/");
  const destination = path.resolve(sourceRoot, relativeDestination);
  if (!relativeDestination || !destination.startsWith(sourceRoot)) {
    console.error(`Overlay destination escapes the source directory: ${overlay}`);
    process.exit(2);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(overlayPath, destination);
  console.log(`Overlaid ${overlay} at ${relativeDestination}`);
}
