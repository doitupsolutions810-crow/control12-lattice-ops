import { spawn } from "node:child_process";
import { randomId } from "../lib/hash.mjs";

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

export class DeploymentCoordinator {
  constructor({ policy, bus, executor = "disabled" }) {
    this.policy = policy;
    this.bus = bus;
    this.executor = executor;
  }

  async plan(request) {
    if (!request.image?.includes("@sha256:")) throw new Error("deployment image must be digest-pinned");
    const policy = await this.policy.evaluate({
      subject: request.subject || "operations",
      capability: "deployment.execute",
      environment: request.environment || "development",
      risk: request.risk || "high",
      approved: request.approved === true
    });
    return { id: randomId("deployment"), createdAt: new Date().toISOString(), request, policy };
  }

  async execute(plan) {
    if (plan.policy.decision !== "allow") throw new Error(`deployment blocked: ${plan.policy.reason}`);
    if (this.executor !== "kubectl") throw new Error("deployment executor is disabled");
    if (!plan.request.manifest) throw new Error("deployment manifest is required");
    await this.bus.publish("deployment.started", { id: plan.id, image: plan.request.image });
    const result = await run("kubectl", ["apply", "-f", "-"], plan.request.manifest);
    await this.bus.publish("deployment.completed", { id: plan.id, code: result.code });
    if (result.code !== 0) throw new Error(`kubectl failed: ${result.stderr}`);
    return result;
  }
}
