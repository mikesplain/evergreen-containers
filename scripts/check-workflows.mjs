#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const workflowDirectory = ".github/workflows";
const pinnedActionPattern = /^\s*uses:\s+([^@\s]+)@([0-9a-f]{40})(?:\s+#.*)?$/;
const localActionPattern = /^\s*uses:\s+\.\/.+$/;
const errors = [];

for (const name of fs.readdirSync(workflowDirectory).sort()) {
  if (!name.endsWith(".yml") && !name.endsWith(".yaml")) {
    continue;
  }

  const file = path.join(workflowDirectory, name);
  const lines = fs.readFileSync(file, "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    if (!line.trimStart().startsWith("uses:") && !line.trimStart().startsWith("- uses:")) {
      continue;
    }

    const normalized = line.replace(/^(\s*)-\s+uses:/, "$1uses:");
    if (!localActionPattern.test(normalized) && !pinnedActionPattern.test(normalized)) {
      errors.push(`${file}:${index + 1}: action must be pinned to a full commit SHA`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Workflow action references are pinned to full commit SHAs.");
