import { buildEvidenceSchema } from "../../../lib/contract.mjs";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  try {
    return res.status(200).json(buildEvidenceSchema());
  } catch {
    return res.status(503).json({
      error: "evidence_contract_unavailable",
      authority: "none"
    });
  }
}
