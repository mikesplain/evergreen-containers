#!/usr/bin/env node

import fs from "node:fs";

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`Missing ${name}`);
  }
  return process.argv[index + 1];
}

function optionalOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fixableHighCritical(file) {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const findings = new Set();

  for (const match of report.matches ?? []) {
    const vulnerability = match.vulnerability ?? {};
    const artifact = match.artifact ?? {};
    const fixed =
      vulnerability.fix?.state === "fixed" ||
      (Array.isArray(vulnerability.fix?.versions) && vulnerability.fix.versions.length > 0);

    if (!fixed || !["High", "Critical"].includes(vulnerability.severity)) {
      continue;
    }

    findings.add(
      [
        vulnerability.id,
        artifact.name,
        artifact.version,
        artifact.type,
        vulnerability.fix?.state
      ].join("|")
    );
  }

  return findings.size;
}

const upstreamFile = optionalOption("--upstream");
const upstream = upstreamFile ? fixableHighCritical(upstreamFile) : undefined;
const candidate = fixableHighCritical(option("--candidate"));
const maximum = Number.parseInt(option("--maximum"), 10);
const requireNoRegression = option("--require-no-regression") === "true";

console.log(
  JSON.stringify(
    {
      upstreamFixableHighCritical: upstream ?? null,
      candidateFixableHighCritical: candidate,
      reduction: upstream === undefined ? null : upstream - candidate,
      maximum,
      requireNoRegression
    },
    null,
    2
  )
);

if (candidate > maximum) {
  console.error(`Candidate has ${candidate} findings, above reviewed maximum ${maximum}.`);
  process.exit(1);
}
if (requireNoRegression && upstream === undefined) {
  console.error("An upstream report is required when regression checks are enabled.");
  process.exit(1);
}
if (requireNoRegression && candidate > upstream) {
  console.error(`Candidate regressed from ${upstream} to ${candidate} findings.`);
  process.exit(1);
}
