import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dockerfile = await readFile(
  new URL("../Dockerfile", import.meta.url),
  "utf8"
);
const compose = await readFile(
  new URL("../compose.yaml", import.meta.url),
  "utf8"
);
const buildScript = await readFile(
  new URL("../scripts/build-image.sh", import.meta.url),
  "utf8"
);
const pushScript = await readFile(
  new URL("../scripts/push-ghcr.sh", import.meta.url),
  "utf8"
);

const workflow = await readFile(
  new URL("../../.github/workflows/control12-image.yml", import.meta.url),
  "utf8"
);

test("OCI image runs as a dedicated non-root user", () => {
  assert.match(dockerfile, /USER 10001:10001/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /tini/);
});

test("Compose keeps the API on localhost and drops capabilities", () => {
  assert.match(compose, /127\.0\.0\.1:/);
  assert.match(compose, /cap_drop:\n\s+- ALL/);
  assert.match(compose, /read_only: true/);
});

test("Compose uses the official llama.cpp server image", () => {
  assert.match(compose, /ghcr\.io\/ggml-org\/llama\.cpp:server/);
  assert.match(compose, /CONTROL12_MODEL_HOST: model/);
});

test("local scripts support multiple builders and require explicit registry auth", () => {
  assert.match(buildScript, /docker podman nerdctl buildah/);
  assert.match(pushScript, /CR_PAT:\?Set CR_PAT/);
  assert.doesNotMatch(pushScript, /ghp_[A-Za-z0-9]+/);
});

test("image workflow publishes multi-platform images with attestations", () => {
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /linux\/amd64,linux\/arm64/);
  assert.match(workflow, /--attest type=provenance,mode=max/);
  assert.match(workflow, /--attest type=sbom/);
});
