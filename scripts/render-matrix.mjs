#!/usr/bin/env node

import { loadCatalog, publicationMatrix, validateCatalog, verificationMatrix } from "./catalog.mjs";

const kind = process.argv[2];
const catalog = loadCatalog();
const errors = validateCatalog(catalog);

if (errors.length > 0) {
  throw new Error(`Invalid catalog:\n${errors.join("\n")}`);
}

if (kind === "verify") {
  console.log(JSON.stringify(verificationMatrix(catalog)));
} else if (kind === "publish") {
  console.log(JSON.stringify(publicationMatrix(catalog)));
} else {
  console.error("Usage: render-matrix.mjs <verify|publish>");
  process.exit(2);
}
