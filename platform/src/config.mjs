import path from "node:path";

const root = process.env.CONTROL12_PLATFORM_ROOT || path.resolve(".control12-platform");

export const config = Object.freeze({
  version: "1.0.0",
  host: process.env.CONTROL12_PLATFORM_HOST || "127.0.0.1",
  port: Number(process.env.CONTROL12_PLATFORM_PORT || 4400),
  root,
  stateDir: path.join(root, "state"),
  artifactDir: path.join(root, "artifacts"),
  auditFile: path.join(root, "audit.jsonl"),
  eventFile: path.join(root, "events.jsonl"),
  registryFile: path.join(root, "registry.json"),
  graphFile: path.join(root, "graph.json"),
  workflowFile: path.join(root, "workflows.json"),
  localAgentUrl: process.env.CONTROL12_LOCAL_AGENT_URL || "http://127.0.0.1:4312",
  apiToken: process.env.CONTROL12_PLATFORM_TOKEN || "",
  deployExecutor: process.env.CONTROL12_DEPLOY_EXECUTOR || "disabled",
  maxBodyBytes: Number(process.env.CONTROL12_MAX_BODY_BYTES || 1_000_000),
  maxConcurrentWorkflows: Number(process.env.CONTROL12_MAX_CONCURRENT_WORKFLOWS || 4)
});
