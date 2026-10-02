import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('packaging contract rejects vulnerable vendor copies despite patched standalone packages', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'flare-packaging-'));
  function metadata(relative, name, version) {
    const dir = path.join(root, relative);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'METADATA'), `Name: ${name}\nVersion: ${version}\n`);
  }
  function check() {
    return spawnSync('python3', ['tests/flaresolverr-packaging.py', root], { encoding: 'utf8' });
  }
  try {
    metadata('wheel.dist-info', 'wheel', '0.46.3');
    metadata('jaraco_context.dist-info', 'jaraco.context', '6.1.0');
    assert.equal(check().status, 0);
    metadata('setuptools/_vendor/jaraco_context.dist-info', 'jaraco.context', '5.3.0');
    assert.match(check().stderr, /Vulnerable jaraco-context 5.3.0/);
    metadata('setuptools/_vendor/jaraco_context.dist-info', 'jaraco.context', '6.1.0');
    metadata('setuptools/_vendor/wheel.dist-info', 'wheel', '0.45.1');
    assert.match(check().stderr, /Vulnerable wheel 0.45.1/);
    metadata('setuptools/_vendor/wheel.dist-info', 'wheel', '0.46.3');
    assert.equal(check().status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime patch updates vendor owner before installing unchanged application requirements', () => {
  const patch = readFileSync('patches/flaresolverr/refresh-runtime-packages.patch', 'utf8');
  assert.match(patch, /\+RUN python -m pip install --no-cache-dir --upgrade setuptools==84\.0\.0 wheel==0\.46\.3/);
  assert.match(patch, /\+    && python -m pip install --no-cache-dir -r requirements\.txt/);
  assert.match(patch, /\+    && python -m pip check/);
});
