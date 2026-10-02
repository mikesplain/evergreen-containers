import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadCatalog, publicationMatrix, verificationMatrix } from "../scripts/catalog.mjs";

test("new image candidates are tested but never published before review", () => {
  const catalog = loadCatalog();
  const names = ["notification-controller", "homepage", "headlamp-plugin-flux", "gluetun"];
  const published = new Set(publicationMatrix(catalog).include.map(({ name }) => name));
  for (const name of names) {
    const image = catalog.images.find((image) => image.name === name);
    assert.equal(image.release.enabled, false);
    assert.equal(image.policy.maxFixableHighCritical, 0);
    assert.equal(image.policy.requireNoRegression, true);
    assert.equal(published.has(name), false);
    assert.equal(verificationMatrix(catalog).include.filter((image) => image.name === name).length, 2);
  }
  const homepage = JSON.parse(fs.readFileSync(new URL("../overlays/homepage/package.json", import.meta.url)));
  assert.equal(homepage.dependencies.next, "16.3.6");
  const lock = fs.readFileSync(new URL("../overlays/homepage/pnpm-lock.yaml", import.meta.url), "utf8");
  assert.match(lock, /next:\n\s+specifier: 16\.3\.6\n\s+version: 16\.3\.6/);
  assert.match(lock, /undici@8\.10\.2/);
  assert.match(lock, /'@grpc\/grpc-js@1\.14\.5'/);
  assert.ok(fs.readFileSync(new URL("../patches/notification-controller/refresh-runtime.patch", import.meta.url), "utf8").includes("grpc@v1.83.2"));
  assert.equal(catalog.images.find(({ name }) => name === "flaresolverr").policy.maxFixableHighCritical, 153);
});
