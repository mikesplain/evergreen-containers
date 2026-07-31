import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("prepare-source applies catalog patches to a source checkout", () => {
  const source = mkdtempSync(path.join(os.tmpdir(), "evergreen-source-"));
  try {
    writeFileSync(
      path.join(source, "Dockerfile"),
      [
        "RUN apt-get update && apt-get install -y locales && rm -rf /var/lib/apt/lists/* \\",
        "  && localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8",
        "",
        "ENV LANG=en_US.utf8",
        "ENV NODE_VERSION=v20.19.0",
        "ENV NODE_ENV=production",
        "",
        "# install build deps",
        "# RUN apt-get update && apt-get install -y python3 make cmake gcc g++",
        "",
        "# install node",
        "RUN apt-get update && apt-get install -y wget xz-utils",
        ""
      ].join("\n")
    );

    const result = spawnSync("node", ["scripts/prepare-source.mjs", source], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        EVERGREEN_PATCHES:
          '["patches/democratic-csi/node-24.patch","patches/democratic-csi/re2-build-deps.patch"]'
      }
    });

    assert.equal(result.status, 0, result.stderr);
    const dockerfile = readFileSync(path.join(source, "Dockerfile"), "utf8");
    assert.match(dockerfile, /v24\.18\.1/);
    assert.match(dockerfile, /python3 make g\+\+/);
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});

test("prepare-source rejects paths outside the patch directory", () => {
  const source = mkdtempSync(path.join(os.tmpdir(), "evergreen-source-"));
  try {
    const result = spawnSync("node", ["scripts/prepare-source.mjs", source], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        EVERGREEN_PATCHES: '["../outside.patch"]'
      }
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Patch does not exist|escapes the patches directory/);
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});

test("prepare-source copies catalog overlays into the source checkout", () => {
  const source = mkdtempSync(path.join(os.tmpdir(), "evergreen-source-"));
  try {
    const result = spawnSync("node", ["scripts/prepare-source.mjs", source], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        EVERGREEN_OVERLAYS: '["overlays/democratic-csi/package.json"]'
      }
    });

    assert.equal(result.status, 0, result.stderr);
    const packageJson = JSON.parse(readFileSync(path.join(source, "package.json"), "utf8"));
    assert.equal(packageJson.dependencies["@kubernetes/client-node"], "^0.22.3");
    assert.equal(packageJson.dependencies.uuid, "^11.1.1");
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});
