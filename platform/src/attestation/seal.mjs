/**
 * Lightweight attestation seals for rotation events and quorum artifacts.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function sealEvent({ kind, payload, outDir }) {
  const body = {
    schema: 'control12.attestation/v1',
    kind,
    at: new Date().toISOString(),
    payload
  };
  const raw = JSON.stringify(body);
  body.sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (outDir) {
    await fs.mkdir(outDir, { recursive: true });
    const file = path.join(outDir, `${kind}-${body.at.replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
    body.file = file;
  }
  return body;
}

export default { sealEvent };
