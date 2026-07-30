#!/usr/bin/env node

import { loadCatalog, validateCatalog } from "./catalog.mjs";

const catalog = loadCatalog(process.argv[2]);
const errors = validateCatalog(catalog);

if (errors.length > 0) {
  console.error("Catalog validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Catalog is valid: ${catalog.images.length} image(s).`);
