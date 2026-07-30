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

let patches;
try {
  patches = JSON.parse(process.env.EVERGREEN_PATCHES ?? "[]");
} catch {
  console.error("EVERGREEN_PATCHES must be a JSON array");
  process.exit(2);
}

if (!Array.isArray(patches) || patches.some((patch) => typeof patch !== "string")) {
  console.error("EVERGREEN_PATCHES must be a JSON array of paths");
  process.exit(2);
}

const repositoryRoot = fs.realpathSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
);
const patchesRoot = fs.realpathSync(path.join(repositoryRoot, "patches")) + path.sep;

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
