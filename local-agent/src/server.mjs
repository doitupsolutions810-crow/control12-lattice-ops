import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.CONTROL12_PORT || 4312);
const MODEL_URL = process.env.CONTROL12_MODEL_URL || "http://127.0.0.1:11435";
const ROOT = path.join(process.env.HOME, ".control12");
const MEMORY_FILE = path.join(ROOT, "state", "memory.jsonl");
const AGENT_SPECS = Object.freeze({
  planner: {
    purpose: "Decompose goals, identify constraints, and define evidence requirements."
  },
  engineer: {
    purpose: "Evaluate implementation, code, dependencies, and runtime behavior."
  },
  artifact: {
    purpose: "Verify files, outputs, hashes, provenance, and reproducibility."
  },
  operations: {
    purpose: "Evaluate service health, host readiness, logs, and lifecycle state."
  },
  verifier: {
    purpose: "Reject unsupported claims and synthesize evidence-backed decisions."
  }
});
const AGENTS = Object.keys(AGENT_SPECS);
const VERSION = "0.8.0";
const COMMAND_TIMEOUT_MS = Number(
  process.env.CONTROL12_COMMAND_TIMEOUT_MS || 120000
);
const MAX_COMMAND_OUTPUT = Number(
  process.env.CONTROL12_MAX_COMMAND_OUTPUT || 2_000_000
);

function send(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function fetchJson(url, options = {}) {
  const { timeoutMs = 120000, signal, ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    signal: signal ?? AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `${url} returned HTTP ${response.status}: ${text.slice(0, 500)}`
    );
  }

  return data;
}

async function getModelId() {
  const models = await fetchJson(`${MODEL_URL}/v1/models`, {
    timeoutMs: 30000
  });

  const id = models.data?.[0]?.id;
  if (!id) throw new Error("No local model is loaded");
  return id;
}

async function complete(
  messages,
  maxTokens = 256,
  schema = null,
  timeoutMs = 180000
) {
  const payload = {
    model: await getModelId(),
    messages,
    temperature: 0,
    max_tokens: maxTokens,
    chat_template_kwargs: {
      enable_thinking: false
    }
  };

  if (schema) {
    payload.response_format = {
      type: "json_schema",
      schema
    };
  }

  return fetchJson(`${MODEL_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    timeoutMs
  });
}

async function appendMemory(record) {
  await fs.mkdir(path.dirname(MEMORY_FILE), {
    recursive: true
  });

  await fs.appendFile(
    MEMORY_FILE,
    JSON.stringify({
      observedAt: new Date().toISOString(),
      ...record
    }) + "\n"
  );
}

function execute(command, cwd = process.env.HOME) {
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd,
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", chunk => {
      if (stdout.length < MAX_COMMAND_OUTPUT) {
        stdout += chunk.toString().slice(0, MAX_COMMAND_OUTPUT - stdout.length);
      }
    });

    child.stderr.on("data", chunk => {
      if (stderr.length < MAX_COMMAND_OUTPUT) {
        stderr += chunk.toString().slice(0, MAX_COMMAND_OUTPUT - stderr.length);
      }
    });

    child.on("error", error => {
      clearTimeout(timer);
      settled = true;
      reject(error);
    });

    child.on("close", code => {
      clearTimeout(timer);
      settled = true;
      resolve({
        code,
        stdout,
        stderr,
        timedOut: code === null
      });
    });
  });
}

async function collectEvidence() {
  const commands = {
    observedAt: "date -u +%Y-%m-%dT%H:%M:%SZ",
    operatingSystem: "sw_vers",
    kernel: "uname -a",
    architecture: "uname -m",
    hardwareModel: "sysctl -n hw.model",
    cpu:
      "sysctl -n machdep.cpu.brand_string 2>/dev/null || sysctl -n hw.model",
    memoryBytes: "sysctl -n hw.memsize",
    disk: "df -h /",
    modelHealth:
      "curl -fsS http://127.0.0.1:11435/health",
    modelInfo:
      "curl -fsS http://127.0.0.1:11435/v1/models",
    processes:
      "ps -axo pid,etime,command | grep -E '[l]lama-server|[s]erver.mjs'",
    files:
      "find $HOME/.control12/app -maxdepth 2 -type f -print | sort | head -60"
  };

  const evidence = {};

  for (const [key, command] of Object.entries(commands)) {
    const result = await execute(command);

    evidence[key] = {
      command,
      exitCode: result.code,
      stdout: result.stdout.trim().slice(0, 5000),
      stderr: result.stderr.trim().slice(0, 1500)
    };
  }

  return evidence;
}

const agentSchema = {
  type: "object",
  properties: {
    role: {
      type: "string"
    },
    decision: {
      enum: ["READY", "DEGRADED", "NOT_READY", "UNKNOWN"]
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: {
            type: "string"
          },
          evidenceKeys: {
            type: "array",
            items: {
              type: "string"
            }
          }
        },
        required: ["claim", "evidenceKeys"],
        additionalProperties: false
      }
    },
    unknowns: {
      type: "array",
      items: {
        type: "string"
      }
    },
    actions: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: [
    "role",
    "decision",
    "findings",
    "unknowns",
    "actions"
  ],
  additionalProperties: false
};

const synthesisSchema = {
  type: "object",
  properties: {
    decision: {
      enum: ["READY", "DEGRADED", "NOT_READY", "UNKNOWN"]
    },
    verifiedSummary: {
      type: "array",
      items: {
        type: "string"
      }
    },
    failedGates: {
      type: "array",
      items: {
        type: "string"
      }
    },
    rejectedClaims: {
      type: "array",
      items: {
        type: "string"
      }
    },
    nextActions: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: [
    "decision",
    "verifiedSummary",
    "failedGates",
    "rejectedClaims",
    "nextActions"
  ],
  additionalProperties: false
};

function parseJsonResponse(response, fallback) {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(content);
  } catch {
    return {
      ...fallback,
      raw: content,
      parseError: true
    };
  }
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    )
  );

  return results;
}

async function runAgent(role, message, includeEvidence = false) {
  if (!AGENT_SPECS[role]) {
    throw new Error(`Unknown agent role: ${role}`);
  }

  const evidence = includeEvidence ? await collectEvidence() : null;
  const userContent = evidence
    ? `TASK:\n${message}\n\nLOCAL_EVIDENCE:\n${JSON.stringify(evidence)}`
    : message;

  const response = await complete(
    [
      {
        role: "system",
        content:
          `You are the CONTROL12 ${role} agent. ${AGENT_SPECS[role].purpose} ` +
          (evidence
            ? "Use only LOCAL_EVIDENCE for factual claims and cite exact evidence keys."
            : "Distinguish facts, assumptions, and recommended actions.")
      },
      {
        role: "user",
        content: userContent
      }
    ],
    280,
    null,
    240000
  );

  const result = {
    status: "LOCAL_AGENT_COMPLETE",
    provider: "llama.cpp",
    role,
    evidenceIncluded: Boolean(evidence),
    content: response.choices?.[0]?.message?.content || "",
    usage: response.usage ?? null,
    timings: response.timings ?? null
  };

  await appendMemory({
    type: "agent",
    role,
    request: message,
    result
  });

  return result;
}

async function runChat(message) {
  const response = await complete(
    [
      {
        role: "system",
        content:
          "You are CONTROL12, a local agent supervisor. " +
          "Answer directly, distinguish verified facts from assumptions, " +
          "and never claim a tool ran unless evidence is supplied."
      },
      {
        role: "user",
        content: message
      }
    ],
    256,
    null,
    180000
  );

  const result = {
    status: "LOCAL_CHAT_COMPLETE",
    provider: "llama.cpp",
    content: response.choices?.[0]?.message?.content || "",
    usage: response.usage ?? null,
    timings: response.timings ?? null
  };

  await appendMemory({
    type: "chat",
    request: message,
    result
  });

  return result;
}

async function runQuorum(message) {
  const startedAt = new Date().toISOString();
  const evidence = await collectEvidence();
  const evidenceText = JSON.stringify(evidence);

  const reports = await mapConcurrent(
    AGENTS,
    2,
    async role => {
      const response = await complete(
        [
          {
            role: "system",
            content:
              `You are the CONTROL12 ${role} agent. ` +
              "Use only LOCAL_EVIDENCE. Every finding must cite exact " +
              "evidence keys. Put missing facts in unknowns. Never invent " +
              "hardware, dates, files, versions, processes, percentages, " +
              "or completed actions."
          },
          {
            role: "user",
            content:
              `TASK:\n${message}\n\nLOCAL_EVIDENCE:\n${evidenceText}`
          }
        ],
        220,
        agentSchema,
        360000
      );

      return parseJsonResponse(response, {
        role,
        decision: "UNKNOWN",
        findings: [],
        unknowns: [
          "Agent response could not be parsed"
        ],
        actions: []
      });
    }
  );

  const synthesisResponse = await complete(
    [
      {
        role: "system",
        content:
          "You are the CONTROL12 verifier-supervisor. " +
          "Use only LOCAL_EVIDENCE and reports. Reject unsupported claims. " +
          "Do not invent readiness percentages or facts not present in evidence."
      },
      {
        role: "user",
        content:
          `TASK:\n${message}\n\n` +
          `LOCAL_EVIDENCE:\n${evidenceText}\n\n` +
          `REPORTS:\n${JSON.stringify(reports)}`
      }
    ],
    300,
    synthesisSchema,
    420000
  );

  const synthesis = parseJsonResponse(synthesisResponse, {
    decision: "UNKNOWN",
    verifiedSummary: [],
    failedGates: [
      "Supervisor output could not be parsed"
    ],
    rejectedClaims: [],
    nextActions: []
  });

  const result = {
    status: "LOCAL_EVIDENCE_QUORUM_COMPLETE",
    provider: "llama.cpp",
    startedAt,
    completedAt: new Date().toISOString(),
    evidence,
    reports,
    synthesis
  };

  await appendMemory({
    type: "quorum",
    request: message,
    result
  });

  return result;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url,
      `http://${req.headers.host || `${HOST}:${PORT}`}`
    );

    if (req.method === "GET" && url.pathname === "/health") {
      const model = await fetchJson(`${MODEL_URL}/health`, {
        timeoutMs: 30000
      });

      return send(res, 200, {
        status: "ok",
        service: "control12",
        version: VERSION,
        model,
        agents: AGENTS,
        agentSpecs: AGENT_SPECS,
        capabilities: [
          "chat",
          "quorum",
          "memory",
          "terminal",
          "evidence-grounding",
          "json-schema",
          "single-agent-execution",
          "live-evidence-endpoint",
          "bounded-terminal-execution"
        ]
      });
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const input = await readBody(req);

      if (
        typeof input.message !== "string" ||
        !input.message.trim()
      ) {
        return send(res, 400, {
          error: "message is required"
        });
      }

      const result =
        url.searchParams.get("mode") === "quorum"
          ? await runQuorum(input.message.trim())
          : await runChat(input.message.trim());

      return send(res, 200, result);
    }

    if (req.method === "GET" && url.pathname === "/api/agents") {
      return send(res, 200, {
        version: VERSION,
        agents: AGENT_SPECS
      });
    }

    if (req.method === "GET" && url.pathname === "/api/evidence") {
      return send(res, 200, {
        observedAt: new Date().toISOString(),
        evidence: await collectEvidence()
      });
    }

    if (
      req.method === "POST" &&
      url.pathname.startsWith("/api/agents/") &&
      url.pathname.endsWith("/run")
    ) {
      const role = url.pathname.split("/")[3];
      const input = await readBody(req);

      if (typeof input.message !== "string" || !input.message.trim()) {
        return send(res, 400, { error: "message is required" });
      }

      const includeEvidence = input.includeEvidence === true;
      return send(
        res,
        200,
        await runAgent(role, input.message.trim(), includeEvidence)
      );
    }

    if (
      req.method === "POST" &&
      url.pathname === "/api/tools/terminal"
    ) {
      const input = await readBody(req);

      if (
        typeof input.command !== "string" ||
        !input.command.trim()
      ) {
        return send(res, 400, {
          error: "command is required"
        });
      }

      const cwd =
        typeof input.cwd === "string" && input.cwd
          ? path.resolve(input.cwd)
          : process.env.HOME;

      const result = await execute(input.command, cwd);

      await appendMemory({
        type: "terminal",
        command: input.command,
        cwd,
        result
      });

      return send(res, 200, result);
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/memory"
    ) {
      try {
        const text = await fs.readFile(MEMORY_FILE, "utf8");
        const requestedLimit = Number(url.searchParams.get("limit") || 100);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 1000)
          : 100;
        const records = text
          .split("\n")
          .filter(Boolean)
          .map(line => JSON.parse(line));

        return send(res, 200, records.slice(-limit));
      } catch {
        return send(res, 200, []);
      }
    }

    if (
      req.method === "GET" &&
      url.pathname === "/api/capabilities"
    ) {
      return send(res, 200, {
        version: VERSION,
        agents: AGENT_SPECS,
        tools: [
          "terminal",
          "memory",
          "local-model",
          "live-evidence",
          "single-agent-runner",
          "five-agent-quorum"
        ],
        limits: {
          commandTimeoutMs: COMMAND_TIMEOUT_MS,
          maxCommandOutputBytes: MAX_COMMAND_OUTPUT
        },
        safety: [
          "localhost-only",
          "evidence-grounding",
          "schema-validation",
          "bounded-command-runtime",
          "bounded-command-output"
        ]
      });
    }

    return send(res, 404, {
      error: "not found"
    });
  } catch (error) {
    return send(res, 500, {
      error:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `CONTROL12 v${VERSION} listening on http://${HOST}:${PORT}`
  );
});
