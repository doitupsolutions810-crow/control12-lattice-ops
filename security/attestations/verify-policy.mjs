import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflows = [
  ".github/workflows/control12-image.yml",
  ".github/workflows/control12-platform-image.yml",
  ".github/workflows/control12-fabric-v2-image.yml"
];

for (const file of workflows) {
  const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
  assert.match(source, /id-token:\s*write/);
  assert.match(source, /attestations:\s*write/);
  assert.match(source, /packages:\s*write/);
  assert.match(source, /artifact-metadata:\s*write/);
  assert.match(source, /actions\/attest@[a-f0-9]{40}/);
  assert.match(source, /subject-digest:/);
  assert.match(source, /push-to-registry:\s*true/);
  assert.match(source, /gh attestation verify/);
  assert.match(source, /oci:\/\//);
}

const installer = await readFile(
  new URL("./enforce-control12.sh", import.meta.url),
  "utf8"
);
assert.match(installer, /policy-controller/);
assert.match(installer, /trust-policies/);
assert.match(installer, /policy\.sigstore\.dev\/include=true/);
assert.match(installer, /doitupsolutions810-crow/);

console.log("PASS: CONTROL12 attestation policy invariants verified");
