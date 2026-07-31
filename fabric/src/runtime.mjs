import path from "node:path";
import { config } from "./config.mjs";
import { TokenService } from "./security/token-service.mjs";
import { RateLimiter } from "./security/rate-limiter.mjs";
import { HashChainLog } from "./events/hash-chain-log.mjs";
import { EventBus } from "./bus/event-bus.mjs";
import { PolicyEngine } from "./policy/policy-engine.mjs";
import { ApprovalStore } from "./approvals/approval-store.mjs";
import { WorkerRegistry } from "./workers/worker-registry.mjs";
import { ArtifactCAS } from "./artifacts/cas.mjs";
import { PluginRegistry } from "./plugins/plugin-registry.mjs";
import { ComponentRegistry } from "./components/component-registry.mjs";
import { KnowledgeGraph } from "./graph/knowledge-graph.mjs";
import { DeploymentCoordinator } from "./deploy/deployment-coordinator.mjs";
import { WorkflowEngine } from "./workflows/workflow-engine.mjs";
import { Metrics } from "./metrics/metrics.mjs";
import { PluginExecutor } from "./plugins/plugin-executor.mjs";
import { EventReplicator } from "./replication/event-replicator.mjs";

export async function createRuntime() {
  const tokens = new TokenService(config.secret); const ledger = new HashChainLog(config.eventFile); const bus = new EventBus(ledger); const policy = new PolicyEngine(config.policyFile); await policy.load();
  const approvals = new ApprovalStore(config.stateDir, bus); const workers = new WorkerRegistry(config.stateDir, bus, { leaseMs: config.workerLeaseMs, staleMs: config.workerStaleMs });
  const artifacts = new ArtifactCAS(config.artifactDir, bus); const plugins = new PluginRegistry({ dir: config.pluginDir, secret: config.secret, bus });
  await plugins.loadBuiltins(path.resolve(new URL("../plugins", import.meta.url).pathname));
  const components = new ComponentRegistry(config.stateDir, bus); const graph = new KnowledgeGraph(config.stateDir); const metrics = new Metrics();
  const deployments = new DeploymentCoordinator({ policy, approvals, bus, environment: config.environment });
  const pluginExecutor = new PluginExecutor({ registry: plugins, policy, approvals, bus, environment: config.environment });
  const replicator = new EventReplicator({ endpoint: config.replicationEndpoint, token: config.replicationToken });
  const workflows = new WorkflowEngine({ stateDir: config.stateDir, bus, approvals, artifacts, workers, deployments, pluginExecutor, maxConcurrent: config.maxConcurrentWorkflows, localAgentUrl: config.localAgentUrl });
  bus.subscribe("*", event => { metrics.inc("control12_events_total", { type: event.type }); graph.upsertNode(event.tenant, { id: event.hash, type: "event", eventType: event.type, observedAt: event.observedAt }); replicator.enqueue(event); });
  return { config, tokens, limiter: new RateLimiter({ limit: config.requestRateLimit }), ledger, bus, policy, approvals, workers, artifacts, plugins, pluginExecutor, components, graph, deployments, workflows, metrics, replicator };
}
