/**
 * Runtime security posture snapshot for operators and smoke tests.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function countLines(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    if (!text) return 0;
    return text.trim().split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

async function sampleAccess(file, max = 2000) {
  try {
    const text = await fs.readFile(file, 'utf8');
    const lines = text.trim().split('\n').filter(Boolean).slice(-max);
    let status401 = 0;
    let sensitiveOk = 0;
    let postNone = 0;
    let mtlsTrue = 0;
    for (const line of lines) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (row.status === 401) status401 += 1;
      if (row.mtls === true) mtlsTrue += 1;
      if (row.method === 'POST' && row.auth === 'none') postNone += 1;
      if (
        row.status != null &&
        row.status < 400 &&
        typeof row.path === 'string' &&
        /\/api\/v1\/(code|terminal)/.test(row.path)
      ) {
        sensitiveOk += 1;
      }
    }
    return {
      sampled: lines.length,
      status401,
      sensitiveOk,
      postNone,
      mtlsTrue
    };
  } catch {
    return { sampled: 0, status401: 0, sensitiveOk: 0, postNone: 0, mtlsTrue: 0 };
  }
}

async function certEndDate(pemPath) {
  if (!(await fileExists(pemPath))) return null;
  try {
    const { stdout } = await execFileAsync('openssl', ['x509', '-enddate', '-noout', '-in', pemPath], {
      timeout: 3000
    });
    const raw = stdout.replace(/^notAfter=/, '').trim();
    const end = new Date(raw);
    if (Number.isNaN(end.getTime())) return { raw, daysRemaining: null };
    const daysRemaining = Math.floor((end.getTime() - Date.now()) / 86400000);
    return { raw, daysRemaining };
  } catch {
    return null;
  }
}

export async function buildSecurityStatus({
  accessLogPath,
  chatOpen,
  requireQuorum,
  apiTokenConfigured
}) {
  const mtls = process.env.CONTROL12_MTLS === '1';
  const mtlsDir = process.env.CONTROL12_MTLS_DIR || path.join(process.env.HOME || '', '.control12-mtls');
  const serverPem = process.env.CONTROL12_TLS_CERT || path.join(mtlsDir, 'server.pem');
  const accessLines = await countLines(accessLogPath);
  const accessSample = await sampleAccess(accessLogPath);
  const cert = await certEndDate(serverPem);

  const findings = [];
  if (accessSample.sensitiveOk > 0) findings.push('sensitive_route_success');
  if (accessSample.postNone > 0) findings.push('post_auth_none');
  if (accessSample.status401 >= Number(process.env.CONTROL12_ANOMALY_401_MIN || 20)) {
    findings.push('elevated_401');
  }
  if (mtls && accessSample.sampled > 10 && accessSample.mtlsTrue === 0) {
    findings.push('mtls_expected_but_unseen');
  }
  if (cert?.daysRemaining != null && cert.daysRemaining < 60) {
    findings.push('cert_nearing_expiry');
  }
  if (chatOpen) findings.push('chat_open_enabled');

  const high = findings.some(f =>
    ['sensitive_route_success', 'post_auth_none'].includes(f)
  );

  return {
    observedAt: new Date().toISOString(),
    mtls,
    chatOpen: Boolean(chatOpen),
    requireQuorum: Boolean(requireQuorum),
    apiTokenConfigured: Boolean(apiTokenConfigured),
    accessLog: {
      path: accessLogPath,
      lines: accessLines,
      ...accessSample
    },
    cert: cert
      ? { path: serverPem, notAfter: cert.raw, daysRemaining: cert.daysRemaining }
      : { path: serverPem, present: await fileExists(serverPem) },
    findings,
    severity: high ? 'high' : findings.length ? 'elevated' : 'ok'
  };
}

export default buildSecurityStatus;
