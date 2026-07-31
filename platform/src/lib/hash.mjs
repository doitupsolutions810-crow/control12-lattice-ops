import crypto from "node:crypto";

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}
