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

// Verify that <image>:<tag> is actually pullable before the script applies a
// detected release tag. Some upstream repos publish "releases" whose tag does
// not correspond to a publishable image tag (e.g. the headlamp plugins monorepo
// releases `plugin-catalog-*`, which is not a tag on headlamp-plugin-flux).
// Without this, the catalog ends up pinned to a nonexistent tag and every
// build fails with `manifest unknown`. Returns false only on a definitive 404;
// throws on unexpected responses so a transient registry failure fails loudly.
function imageTagExists(image) {
  const firstSlash = image.indexOf("/");
  if (firstSlash === -1) return false;
  const host = image.slice(0, firstSlash);
  const rest = image.slice(firstSlash + 1);
  const colon = rest.lastIndexOf(":");
  const slash = rest.lastIndexOf("/");
  if (colon <= slash) return false;
  const repo = rest.slice(0, colon);
  const tag = rest.slice(colon + 1);
  const accept = "application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json";
  const url = `https://${host}/v2/${repo}/manifests/${encodeURIComponent(tag)}`;
  const code = (headers) => execFileSync("curl", ["-sSL", "-o", "/dev/null", "-w", "%{http_code}", ...headers, url], { encoding: "utf8" }).trim();
  let status = code(["-H", `Accept: ${accept}`]);
  if (status === "200") return true;
  if (status === "404") return false;
  if (status === "401") {
    const dump = execFileSync("curl", ["-sSL", "-o", "/dev/null", "-D", "-", "-H", `Accept: ${accept}`, url], { encoding: "utf8" });
    const auths = dump.split("\n").filter((l) => /^www-authenticate:/i.test(l));
    const auth = auths[auths.length - 1] || "";
    const realm = (auth.match(/realm="([^"]+)"/) || [])[1];
    const service = (auth.match(/service="([^"]+)"/) || [])[1];
    const scope = (auth.match(/scope="([^"]+)"/) || [])[1];
    if (!realm) throw new Error(`could not parse WWW-Authenticate for ${image}`);
    const tok = JSON.parse(execFileSync("curl", ["-fsSL", `${realm}?service=${encodeURIComponent(service)}&scope=${encodeURIComponent(scope)}`], { encoding: "utf8" }).trim());
    const bearer = tok.token || tok.access_token;
    if (!bearer) throw new Error(`no bearer token for ${image}`);
    status = code(["-H", `Accept: ${accept}`, "-H", `Authorization: Bearer ${bearer}`]);
    if (status === "200") return true;
    if (status === "404") return false;
  }
  throw new Error(`unexpected registry response (${status}) for ${image}`);
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
  const candidateImage = image.upstream.image.replace(/:[^:@]+$/, `:${release.tag_name}`);
  if (!imageTagExists(candidateImage)) {
    console.warn(`${image.name}: release tag ${release.tag_name} is not a publishable tag for ${candidateImage}; skipping`);
    continue;
  }
  image.upstream.sourceTag = release.tag_name;
  image.upstream.sourceCommit = commit;
  image.upstream.version = release.tag_name;
  image.upstream.image = image.upstream.image.replace(/:[^:@]+$/, `:${release.tag_name}`);
  console.log(`${image.name}: ${sourceTag} -> ${release.tag_name} (${commit})`);
  changed = true;
}
if (changed) fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
else console.log("No upstream release updates found.");
