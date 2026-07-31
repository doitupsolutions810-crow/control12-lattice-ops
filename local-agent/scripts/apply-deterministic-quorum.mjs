#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error("Usage: apply-deterministic-quorum.mjs <server.mjs>");
  process.exit(2);
}

const file = path.resolve(target);
const source = fs.readFileSync(file, "utf8");

function replaceFunction(text, signature, replacement) {
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`Function not found: ${signature}`);

  const brace = text.indexOf("{", start);
  if (brace < 0) throw new Error(`Opening brace not found: ${signature}`);

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = brace; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(0, start) + replacement + text.slice(index + 1);
      }
    }
  }

  throw new Error(`Closing brace not found: ${signature}`);
}

const deterministicHelpers = `function deterministicReadiness(role, evidence) {
  const required = [
    "operatingSystem",
    "architecture",
    "modelHealth",
    "modelInfo",
    "processes",
    "files"
  ];

  const failed = required.filter(key => evidence[key]?.exitCode !== 0);
  const modelReady = evidence.modelHealth?.stdout?.includes('"status":"ok"');
  const applicationRunning = evidence.processes?.stdout?.includes("server.mjs");
  const modelRunning = evidence.processes?.stdout?.includes("llama-server");

  const findings = [];

  if (evidence.operatingSystem?.exitCode === 0) {
    findings.push({
      claim: "Operating-system evidence was collected successfully.",
      evidenceKeys: ["operatingSystem"]
    });
  }

  if (evidence.architecture?.exitCode === 0) {
    findings.push({
      claim: \`Host architecture is \${evidence.architecture.stdout.trim()}.\`,
      evidenceKeys: ["architecture"]
    });
  }

  if (modelReady) {
    findings.push({
      claim: "The local llama.cpp health endpoint reports ok.",
      evidenceKeys: ["modelHealth"]
    });
  }

  if (applicationRunning && modelRunning) {
    findings.push({
      claim: "Both the CONTROL12 application process and llama-server process are present.",
      evidenceKeys: ["processes"]
    });
  }

  return {
    role,
    decision:
      failed.length === 0 && modelReady && applicationRunning && modelRunning
        ? "READY"
        : failed.length > 0 || !modelReady
          ? "DEGRADED"
          : "UNKNOWN",
    findings,
    unknowns: failed.map(key => \`Evidence collection failed for \${key}.\`),
    actions:
      failed.length === 0
        ? []
        : ["Repair failed evidence commands and rerun the quorum."]
  };
}
`;

const deterministicQuorum = `async function runQuorum(message) {
  const startedAt = new Date().toISOString();
  const evidence = await collectEvidence();

  const roleActions = {
    planner: [
      "Define the next requested change as a bounded workflow before execution."
    ],
    engineer: [
      "Run source syntax and test validation before promoting code changes."
    ],
    artifact: [
      "Generate hashes and provenance for release artifacts before publication."
    ],
    operations: [
      "Continue monitoring application and model health endpoints."
    ],
    verifier: [
      "Reject future readiness claims that do not cite evidence keys."
    ]
  };

  const reports = AGENTS.map(role => {
    const report = deterministicReadiness(role, evidence);
    return {
      ...report,
      actions: [
        ...(Array.isArray(report.actions) ? report.actions : []),
        ...(roleActions[role] ?? [])
      ]
    };
  });

  const failedReports = reports.filter(report => report.decision !== "READY");
  const verifiedSummary = [
    ...new Set(
      reports.flatMap(report =>
        Array.isArray(report.findings)
          ? report.findings.map(item => item.claim).filter(Boolean)
          : []
      )
    )
  ].slice(0, 20);
  const failedGates = [
    ...new Set(
      reports.flatMap(report =>
        Array.isArray(report.unknowns) ? report.unknowns : []
      )
    )
  ].slice(0, 20);
  const nextActions = [
    ...new Set(
      reports.flatMap(report =>
        Array.isArray(report.actions) ? report.actions : []
      )
    )
  ].slice(0, 20);

  const synthesis = {
    decision:
      failedReports.length === 0
        ? "READY"
        : reports.some(report => report.decision === "NOT_READY")
          ? "NOT_READY"
          : "DEGRADED",
    verifiedSummary,
    failedGates,
    rejectedClaims: [
      "Model-generated readiness JSON is non-authoritative and is not used for the quorum decision.",
      "Readiness percentages and uncited environment claims are rejected."
    ],
    nextActions
  };

  const result = {
    status: "LOCAL_EVIDENCE_QUORUM_COMPLETE",
    provider: "deterministic-local-evidence",
    requestedTask: message,
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
`;

let output = source;
if (!output.includes("function deterministicReadiness(")) {
  const insertionPoint = output.indexOf("async function mapConcurrent(");
  if (insertionPoint < 0) {
    throw new Error("Could not locate helper insertion point");
  }
  output = output.slice(0, insertionPoint) + deterministicHelpers + "\n" + output.slice(insertionPoint);
}

output = replaceFunction(output, "async function runQuorum(", deterministicQuorum.trimEnd());
output = output.replace('const VERSION = "0.8.0";', 'const VERSION = "0.8.1";');
output = output.replace(
  '"five-agent-quorum"',
  '"five-agent-quorum",\n          "deterministic-readiness"'
);
output = output.replace(
  '"bounded-command-output"',
  '"bounded-command-output",\n          "model-independent-readiness"'
);

fs.writeFileSync(file, output);
console.log(`Patched deterministic quorum: ${file}`);
