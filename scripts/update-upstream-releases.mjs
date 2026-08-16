#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const catalogPath = process.argv[2] ?? "catalog/images.json";
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const token = process.env.GITHUB_TOKEN;
if (!token) { console.error("GITHUB_TOKEN is required"); process.exit(2); }

function github(path) {
  return JSON.parse(execFileSync("curl", ["-fsSL", "-H", "Authorization: Bearer " + token, "-H", "Accept: application/vnd.github+json", `https://api.github.com${path}`], { encoding: "utf8" }));
}

let changed = false;
for (const image of catalog.images) {
  const { sourceRepository, sourceTag, sourceCommit } = image.upstream;
  let release;
  try {
    release = github(`/repos/${sourceRepository}/releases/latest`);
  } catch {
    console.warn(`${image.name}: no published GitHub release; skipping`);
    continue;
  }
  if (!release.tag_name || release.draft || release.prerelease || release.tag_name === sourceTag) continue;
  let ref;
  try {
    ref = github(`/repos/${sourceRepository}/git/ref/tags/${encodeURIComponent(release.tag_name)}`);
  } catch {
    console.warn(`${image.name}: release tag ${release.tag_name} could not be resolved; skipping`);
    continue;
  }
  const object = ref.object?.type === "tag" ? github(`/repos/${sourceRepository}/git/tags/${ref.object.sha}`).object : ref.object;
  const commit = object?.sha;
  if (!commit || commit === sourceCommit) continue;
  image.upstream.sourceTag = release.tag_name;
  image.upstream.sourceCommit = commit;
  image.upstream.version = release.tag_name;
  image.upstream.image = image.upstream.image.replace(/:[^:@]+$/, `:${release.tag_name}`);
  console.log(`${image.name}: ${sourceTag} -> ${release.tag_name} (${commit})`);
  changed = true;
}
if (changed) fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
else console.log("No upstream release updates found.");
