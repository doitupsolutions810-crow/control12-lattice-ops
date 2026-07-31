import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const target = path.resolve(
  process.argv[2] || "local-agent/src/server.mjs"
);

let source = await fs.readFile(target, "utf8");
const original = source;

const responseFormatBefore = `  if (schema) {\n    payload.response_format = {\n      type: \"json_schema\",\n      schema\n    };\n  }`;

const responseFormatAfter = `  if (schema) {\n    payload.response_format = {\n      type: \"json_schema\",\n      json_schema: {\n        name: \"control12_response\",\n        strict: true,\n        schema\n      }\n    };\n  }`;

if (!source.includes(responseFormatBefore)) {
  throw new Error("Expected response_format block not found; source may already be patched or has drifted");
}
source = source.replace(responseFormatBefore, responseFormatAfter);

const parserBefore = `function parseJsonResponse(response, fallback) {\n  const content = response.choices?.[0]?.message?.content;\n\n  if (typeof content !== \"string\") {\n    return fallback;\n  }\n\n  try {\n    return JSON.parse(content);\n  } catch {\n    return {\n      ...fallback,\n      raw: content,\n      parseError: true\n    };\n  }\n}`;

const parserAfter = `function parseJsonResponse(response, fallback) {\n  const content = response.choices?.[0]?.message?.content;\n\n  if (typeof content !== \"string\") {\n    return fallback;\n  }\n\n  const candidates = [\n    content.trim(),\n    content.match(/\\\`\\\`\\\`(?:json)?\\s*([\\s\\S]*?)\\\`\\\`\\\`/i)?.[1]?.trim(),\n    content.slice(content.indexOf(\"{\"), content.lastIndexOf(\"}\") + 1)\n  ].filter(Boolean);\n\n  for (const candidate of candidates) {\n    try {\n      return JSON.parse(candidate);\n    } catch {\n      // Try the next bounded candidate.\n    }\n  }\n\n  return {\n    ...fallback,\n    raw: content,\n    parseError: true\n  };\n}`;

if (!source.includes(parserBefore)) {
  throw new Error("Expected parseJsonResponse block not found; source may already be patched or has drifted");
}
source = source.replace(parserBefore, parserAfter);

const agentInstruction = `              \"or completed actions.\"`;
const agentInstructionReplacement = `              \"or completed actions. Return exactly one JSON object matching the supplied schema. Do not use markdown, prose, or code fences.\"`;
if (!source.includes(agentInstruction)) {
  throw new Error("Expected agent instruction not found");
}
source = source.replace(agentInstruction, agentInstructionReplacement);

const supervisorInstruction = `          \"Do not invent readiness percentages or facts not present in evidence.\"`;
const supervisorInstructionReplacement = `          \"Do not invent readiness percentages or facts not present in evidence. Return exactly one JSON object matching the supplied schema. Do not use markdown, prose, or code fences.\"`;
if (!source.includes(supervisorInstruction)) {
  throw new Error("Expected supervisor instruction not found");
}
source = source.replace(supervisorInstruction, supervisorInstructionReplacement);

if (source === original) {
  throw new Error("No changes were made");
}

const backup = `${target}.backup-quorum-json`;
await fs.writeFile(backup, original, { flag: "wx" }).catch(error => {
  if (error.code !== "EEXIST") throw error;
});
await fs.writeFile(target, source);

console.log(JSON.stringify({
  status: "patched",
  target,
  backup,
  changes: [
    "OpenAI-compatible json_schema envelope",
    "strict JSON-only prompts",
    "bounded fenced/prefixed JSON recovery"
  ]
}, null, 2));
