/**
 * HTTP or HTTPS+mTLS server factory.
 *
 * Env:
 *   CONTROL12_MTLS=1
 *   CONTROL12_TLS_CERT  path to server cert PEM
 *   CONTROL12_TLS_KEY   path to server key PEM
 *   CONTROL12_TLS_CA    path to client CA PEM (required when MTLS=1)
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

export function createAppServer(handler) {
  const mtls = process.env.CONTROL12_MTLS === '1';
  const certPath = process.env.CONTROL12_TLS_CERT || '';
  const keyPath = process.env.CONTROL12_TLS_KEY || '';
  const caPath = process.env.CONTROL12_TLS_CA || '';

  if (!mtls && !certPath) {
    return { server: http.createServer(handler), mode: 'http', mtls: false };
  }

  if (!certPath || !keyPath) {
    throw new Error('CONTROL12_TLS_CERT and CONTROL12_TLS_KEY are required for TLS/mTLS');
  }

  const opts = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  };

  if (mtls) {
    if (!caPath) {
      throw new Error('CONTROL12_TLS_CA is required when CONTROL12_MTLS=1');
    }
    opts.ca = fs.readFileSync(caPath);
    opts.requestCert = true;
    opts.rejectUnauthorized = true;
  }

  return {
    server: https.createServer(opts, handler),
    mode: mtls ? 'https-mtls' : 'https',
    mtls
  };
}
