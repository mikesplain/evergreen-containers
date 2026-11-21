import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateResponse } from './flaresolverr-response.mjs';

const response = (status = 200, html = '<html><title>Example Domain</title></html>') => ({
  status: 'ok', solution: { status, response: html },
});

test('accepts the expected target page', () => {
  assert.doesNotThrow(() => validateResponse(response()));
});

test('rejects API ok with failed target status', () => {
  for (const status of [403, 429, 500, 503]) {
    assert.throws(() => validateResponse(response(status)), /Unexpected solution status/);
  }
});

test('rejects API ok with synthetic 200 and an error page', () => {
  for (const html of ['<title>503 Service Unavailable</title>', '<title>Just a moment...</title>', '']) {
    assert.throws(() => validateResponse(response(200, html)), /Expected target content missing/);
  }
});

test('rejects API error and missing solution', () => {
  assert.throws(() => validateResponse({ ...response(), status: 'error' }), /API did not succeed/);
  assert.throws(() => validateResponse({ status: 'ok' }), /Unexpected solution status/);
});

test('shell entry point fails closed for malformed JSON and unsuccessful content', () => {
  for (const value of ['not json', JSON.stringify(response(200, '<title>Bad Gateway</title>'))]) {
    const result = spawnSync(process.execPath, ['tests/flaresolverr-response.mjs'], {
      env: { ...process.env, RESPONSE: value }, encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
  }
});
