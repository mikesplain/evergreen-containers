import assert from "node:assert/strict";
import test from "node:test";

import {
  loadCatalog,
  publicationMatrix,
  validateCatalog,
  verificationMatrix
} from "../scripts/catalog.mjs";

test("the committed catalog is valid", () => {
  const catalog = loadCatalog();
  assert.deepEqual(validateCatalog(catalog), []);
});

test("verification expands every platform", () => {
  const matrix = verificationMatrix(loadCatalog());
  assert.equal(matrix.include.length, 6);
  assert.deepEqual(
    matrix.include.map(({ platform }) => platform),
    [
      "linux/amd64",
      "linux/arm64",
      "linux/amd64",
      "linux/arm64",
      "linux/amd64",
      "linux/arm64"
    ]
  );
  assert.deepEqual(
    matrix.include.map(({ runner }) => runner),
    [
      "ubuntu-24.04",
      "ubuntu-24.04-arm",
      "ubuntu-24.04",
      "ubuntu-24.04-arm",
      "ubuntu-24.04",
      "ubuntu-24.04-arm"
    ]
  );
});

test("publication retains one entry per image", () => {
  const matrix = publicationMatrix(loadCatalog());
  assert.equal(matrix.include.length, 1);
  assert.equal(
    matrix.include[0].outputImage,
    "ghcr.io/mikesplain/evergreen-containers/flaresolverr"
  );
  assert.equal(matrix.include[0].platforms, "linux/amd64,linux/arm64");
  assert.equal(matrix.include[0].maxFixableHighCritical, 12);
});

test("release-disabled candidates are verified but not published", () => {
  const catalog = loadCatalog();
  const verifyNames = new Set(verificationMatrix(catalog).include.map(({ name }) => name));
  const releaseVerifyNames = new Set(
    verificationMatrix(catalog, true).include.map(({ name }) => name)
  );
  const publishNames = new Set(publicationMatrix(catalog).include.map(({ name }) => name));

  assert.ok(verifyNames.has("democratic-csi"));
  assert.ok(verifyNames.has("sockpuppetbrowser"));
  assert.ok(!releaseVerifyNames.has("democratic-csi"));
  assert.ok(!releaseVerifyNames.has("sockpuppetbrowser"));
  assert.ok(!publishNames.has("democratic-csi"));
  assert.ok(!publishNames.has("sockpuppetbrowser"));
});

test("build overrides and patches are rendered for verification", () => {
  const matrix = verificationMatrix(loadCatalog());
  const democraticCsi = matrix.include.find(({ name }) => name === "democratic-csi");

  assert.match(democraticCsi.buildArgs, /^CTR_VERSION=v2\.3\.3/m);
  assert.match(democraticCsi.buildArgs, /^RCLONE_VERSION=1\.74\.4/m);
  assert.equal(democraticCsi.hasPatches, true);
  assert.equal(democraticCsi.modifiedBuild, true);
  assert.deepEqual(JSON.parse(democraticCsi.patches), [
    "patches/democratic-csi/node-24.patch",
    "patches/democratic-csi/re2-build-deps.patch",
    "patches/democratic-csi/ctr-official-release.patch"
  ]);
});

test("unsafe build argument values are rejected", () => {
  const catalog = loadCatalog();
  catalog.images[1].build.args.CTR_VERSION = "v2.3.3\nUNSAFE=value";

  assert.ok(
    validateCatalog(catalog).some((error) => error.includes("contains unsupported characters"))
  );
});

test("missing or escaping patch paths are rejected", () => {
  const catalog = loadCatalog();
  catalog.images[1].build.patches = ["../outside.patch"];

  assert.ok(
    validateCatalog(catalog).some((error) =>
      error.includes("must reference an existing .patch file")
    )
  );
});

test("duplicate names are rejected", () => {
  const catalog = loadCatalog();
  catalog.images.push(structuredClone(catalog.images[0]));
  assert.ok(validateCatalog(catalog).some((error) => error.includes("duplicates flaresolverr")));
});
