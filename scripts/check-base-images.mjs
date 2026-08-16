#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const token = process.env.GITHUB_TOKEN;
if (!token) { console.error("GITHUB_TOKEN is required"); process.exit(2); }
const catalog = JSON.parse(fs.readFileSync("catalog/images.json", "utf8"));
const headers = ["-H", `Authorization: Bearer ${token}`, "-H", "Accept: application/vnd.github+json"];
function get(path) { return JSON.parse(execFileSync("curl", ["-fsSL", ...headers, `https://api.github.com${path}`], { encoding: "utf8" })); }
const findings = [];
for (const image of catalog.images) {
  const { sourceRepository, sourceCommit, dockerfile } = image.upstream;
  const file = get(`/repos/${sourceRepository}/contents/${dockerfile}?ref=${sourceCommit}`);
  const text = Buffer.from(file.content, "base64").toString("utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?([^\s]+)(?:\s+AS\s+\S+)?/i);
    if (match) findings.push(`| ${image.name} | ${sourceRepository}@${sourceCommit.slice(0, 12)} | \`${match[1]}\` |`);
  }
}
const report = ["# Upstream base-image inventory", "", "| Image | Source | FROM reference |", "| --- | --- | --- |", ...findings, ""].join("\n");
fs.writeFileSync(process.env.GITHUB_STEP_SUMMARY ?? "base-images.md", report);
fs.writeFileSync("base-images.md", report);
console.log(report);
