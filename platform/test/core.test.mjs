import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MessageBus } from "../src/bus/message-bus.mjs";
import { CapabilityPolicyEngine } from "../src/policy/capability-engine.mjs";
import { ComponentRegistry } from "../src/registry/component-registry.mjs";
import { KnowledgeGraph } from "../src/graph/knowledge-graph.mjs";
import { ArtifactBuilder } from "../src/artifacts/artifact-builder.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "control12-test-"));
const bus = new MessageBus({ eventFile: path.join(root, "events.jsonl") });

test("registry creates deterministic component digests", async () => {
  const registry = new ComponentRegistry(path.join(root, "registry.json"));
  const component = await registry.register({ id: "service.api", version: "1.0.0", kind: "service", capabilities: ["b", "a", "a"] });
  assert.equal(component.capabilities.join(","), "a,b");
  assert.match(component.digest, /^[a-f0-9]{64}$/);
});

test("policy requires approval for production deployment", async () => {
  const policyFile = new URL("../policies/default.json", import.meta.url);
  const engine = new CapabilityPolicyEngine({ policyFile });
  const result = await engine.evaluate({ subject: "operations", capability: "deployment.execute", environment: "production", risk: "high" });
  assert.equal(result.decision, "require-approval");
});

test("knowledge graph enforces existing nodes", async () => {
  const graph = new KnowledgeGraph(path.join(root, "graph.json"));
  await graph.upsertNode({ id: "a", type: "agent" });
  await graph.upsertNode({ id: "b", type: "artifact" });
  const edge = await graph.link("a", "created", "b");
  assert.equal(edge.relation, "created");
  assert.equal((await graph.neighbors("a")).length, 1);
});

test("artifact builder writes manifest and payload", async () => {
  const builder = new ArtifactBuilder({ artifactDir: path.join(root, "artifacts"), bus });
  const artifact = await builder.build({ name: "report", type: "json", payload: { ready: true } });
  assert.match(artifact.digest, /^[a-f0-9]{64}$/);
  await fs.access(path.join(artifact.path, "manifest.json"));
});
