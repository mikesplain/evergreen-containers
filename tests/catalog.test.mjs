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
  assert.equal(matrix.include.length, 2);
  assert.deepEqual(
    matrix.include.map(({ platform }) => platform),
    ["linux/amd64", "linux/arm64"]
  );
  assert.deepEqual(
    matrix.include.map(({ runner }) => runner),
    ["ubuntu-24.04", "ubuntu-24.04-arm"]
  );
});

test("publication retains one entry per image", () => {
  const matrix = publicationMatrix(loadCatalog());
  assert.equal(matrix.include.length, 1);
  assert.equal(matrix.include[0].platforms, "linux/amd64,linux/arm64");
  assert.equal(matrix.include[0].maxFixableHighCritical, 12);
});

test("duplicate names are rejected", () => {
  const catalog = loadCatalog();
  catalog.images.push(structuredClone(catalog.images[0]));
  assert.ok(validateCatalog(catalog).some((error) => error.includes("duplicates flaresolverr")));
});
