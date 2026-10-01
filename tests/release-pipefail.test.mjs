import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

test("release policy pipelines preserve the evaluator's exit status", () => {
  // Actions' unspecified Linux shell is bash -e, without pipefail. Selecting
  // bash explicitly uses --noprofile --norc -e -o pipefail instead.
  assert.match(workflow, /defaults:\n  run:\n    shell: bash\n/);
  const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", "node -e 'process.exit(1)' | tee /dev/null"]);
  assert.equal(result.status, 1);
});
