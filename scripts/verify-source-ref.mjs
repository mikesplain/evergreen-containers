#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const [repository, tag, expectedCommit] = process.argv.slice(2);
if (!repository || !tag || !expectedCommit) {
  console.error("Usage: verify-source-ref.mjs <owner/repository> <tag> <commit>");
  process.exit(2);
}

const remote = `https://github.com/${repository}.git`;
const result = spawnSync(
  "git",
  ["ls-remote", remote, `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const refs = new Map(
  result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/, 2).reverse())
);
const resolved =
  refs.get(`refs/tags/${tag}^{}`) ??
  refs.get(`refs/tags/${tag}`);

if (!resolved) {
  console.error(`Could not resolve ${repository} tag ${tag}.`);
  process.exit(1);
}
if (resolved !== expectedCommit) {
  console.error(
    `${repository} tag ${tag} resolved to ${resolved}; expected ${expectedCommit}.`
  );
  process.exit(1);
}

console.log(`${repository} ${tag} resolves to pinned commit ${expectedCommit}.`);
