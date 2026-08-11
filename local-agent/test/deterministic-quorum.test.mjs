import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url);
const source = new URL("../src/server.mjs", import.meta.url);
const transformer = new URL(
  "../scripts/apply-deterministic-quorum.mjs",
  import.meta.url
);

test("deterministic quorum transformer produces model-independent readiness", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "control12-quorum-"));
  const target = path.join(directory, "server.mjs");

  try {
    await copyFile(source, target);

    const result = spawnSync(
      process.execPath,
      [transformer.pathname, target],
      { encoding: "utf8" }
    );

    assert.equal(result.status, 0, result.stderr);

    const patched = await readFile(target, "utf8");
    assert.match(patched, /function deterministicReadiness\(/);
    assert.match(patched, /provider: "deterministic-local-evidence"/);
    assert.match(patched, /Model-generated readiness JSON is non-authoritative/);
    assert.match(patched, /const VERSION = "0\.8\.1"/);

    const syntax = spawnSync(process.execPath, ["--check", target], {
      encoding: "utf8"
    });
    assert.equal(syntax.status, 0, syntax.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("transformer is idempotent", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "control12-idempotent-"));
  const target = path.join(directory, "server.mjs");

  try {
    await copyFile(source, target);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = spawnSync(
        process.execPath,
        [transformer.pathname, target],
        { encoding: "utf8" }
      );
      assert.equal(result.status, 0, result.stderr);
    }

    const patched = await readFile(target, "utf8");
    assert.equal(
      patched.match(/function deterministicReadiness\(/g)?.length,
      1
    );
    assert.equal(
      patched.match(/provider: "deterministic-local-evidence"/g)?.length,
      1
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
