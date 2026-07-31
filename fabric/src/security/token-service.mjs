import crypto from "node:crypto";
import { canonical, randomId, timingSafeEqualText } from "../lib/canonical.mjs";

const encode = value => Buffer.from(typeof value === "string" ? value : canonical(value)).toString("base64url");
const decode = value => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

export class TokenService {
  constructor(secret) {
    if (!secret || secret.length < 32) throw new Error("CONTROL12_FABRIC_SECRET must contain at least 32 characters");
    this.secret = secret;
  }
  sign(input) { return crypto.createHmac("sha256", this.secret).update(input).digest("base64url"); }
  issue({ tenant, subject, scopes = [], ttlSeconds = 3600 }) {
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: "HS256", typ: "C12" });
    const payload = encode({ iss: "control12", tenant, sub: subject, scopes: [...new Set(scopes)].sort(), iat: now, exp: now + ttlSeconds, jti: randomId("tok") });
    const body = `${header}.${payload}`;
    return `${body}.${this.sign(body)}`;
  }
  verify(token, requiredScopes = []) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw Object.assign(new Error("invalid token"), { statusCode: 401 });
    const body = `${parts[0]}.${parts[1]}`;
    if (!timingSafeEqualText(this.sign(body), parts[2])) throw Object.assign(new Error("invalid token signature"), { statusCode: 401 });
    const claims = decode(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== "control12" || !claims.tenant || !claims.sub || claims.exp <= now) throw Object.assign(new Error("expired or invalid token"), { statusCode: 401 });
    for (const scope of requiredScopes) if (!claims.scopes?.includes(scope) && !claims.scopes?.includes("fabric.admin")) throw Object.assign(new Error(`missing scope: ${scope}`), { statusCode: 403 });
    return claims;
  }
}
