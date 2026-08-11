/**
 * Structured access logging for tunnel / API traffic.
 * Writes JSON lines to access log file (separate from audit event bus).
 */

import { appendJsonLine } from '../lib/json-store.mjs';

export class AccessLog {
  constructor(file) {
    this.file = file;
  }

  async write(entry) {
    if (!this.file) return;
    await appendJsonLine(this.file, {
      type: 'access',
      observedAt: new Date().toISOString(),
      ...entry
    });
  }

  /**
   * Wrap res.end so status is known when logging.
   */
  instrument(req, res, meta = {}) {
    const start = Date.now();
    const remote =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const cert = req.socket?.getPeerCertificate?.();
    const clientCert = cert && cert.subject
      ? {
          subject: cert.subject,
          fingerprint: cert.fingerprint256 || cert.fingerprint || null,
          authorized: req.client?.authorized ?? req.socket?.authorized ?? null
        }
      : null;

    const originalEnd = res.end.bind(res);
    res.end = (...args) => {
      const result = originalEnd(...args);
      void this.write({
        method: req.method,
        path: meta.path || req.url?.split('?')[0] || null,
        status: res.statusCode,
        durationMs: Date.now() - start,
        remote,
        host: req.headers.host || null,
        userAgent: req.headers['user-agent'] || null,
        auth: meta.auth || null,
        chatOpen: meta.chatOpen ?? null,
        mtls: Boolean(clientCert),
        clientCert,
        error: meta.error || null
      });
      return result;
    };
  }
}

export default AccessLog;
