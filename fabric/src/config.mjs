import path from "node:path";
import os from "node:os";

const root = path.resolve(process.env.CONTROL12_FABRIC_ROOT || path.join(os.homedir(), ".control12", "fabric-v2"));

export const config = Object.freeze({
  version: "2.0.0",
  host: process.env.CONTROL12_FABRIC_HOST || "127.0.0.1",
  port: Number(process.env.CONTROL12_FABRIC_PORT || 4500),
  root,
  secret: process.env.CONTROL12_FABRIC_SECRET || "",
  bootstrapSecret: process.env.CONTROL12_BOOTSTRAP_SECRET || "",
  localAgentUrl: process.env.CONTROL12_LOCAL_AGENT_URL || "http://127.0.0.1:4312",
  environment: process.env.CONTROL12_ENVIRONMENT || "development",
  maxBodyBytes: Number(process.env.CONTROL12_MAX_BODY_BYTES || 1_048_576),
  maxConcurrentWorkflows: Number(process.env.CONTROL12_MAX_CONCURRENT_WORKFLOWS || 4),
  workerLeaseMs: Number(process.env.CONTROL12_WORKER_LEASE_MS || 60_000),
  workerStaleMs: Number(process.env.CONTROL12_WORKER_STALE_MS || 120_000),
  requestRateLimit: Number(process.env.CONTROL12_REQUEST_RATE_LIMIT || 240),
  pluginDir: path.resolve(process.env.CONTROL12_PLUGIN_DIR || path.join(root, "plugins")),
  replicationEndpoint: process.env.CONTROL12_REPLICATION_ENDPOINT || "",
  replicationToken: process.env.CONTROL12_REPLICATION_TOKEN || "",
  policyFile: path.resolve(process.env.CONTROL12_POLICY_FILE || new URL("../policies/default.json", import.meta.url).pathname),
  dashboardDir: path.resolve(new URL("../dashboard", import.meta.url).pathname),
  eventFile: path.join(root, "ledger", "events.jsonl"),
  auditFile: path.join(root, "ledger", "audit.jsonl"),
  stateDir: path.join(root, "state"),
  artifactDir: path.join(root, "artifacts")
});
