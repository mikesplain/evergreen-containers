import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Upstream v3.5.2 synthesizes solution.status=200; it is not target HTTP evidence.
export function validateResponse(response) {
  assert.equal(response.status, 'ok', 'FlareSolverr API did not succeed');
  assert.equal(response.solution?.status, 200, 'Unexpected solution status');
  assert.match(response.solution?.response ?? '', /<title>Example Domain<\/title>/,
    'Expected target content missing (API ok alone is insufficient)');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateResponse(JSON.parse(process.env.RESPONSE));
  console.log('FlareSolverr contract passed: expected target content received');
}
