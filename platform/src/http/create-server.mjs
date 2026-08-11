/**
 * HTTP or HTTPS+mTLS server factory with dual-CA trust and hot reload.
 *
 * Env:
 *   CONTROL12_MTLS=1
 *   CONTROL12_TLS_CERT / KEY / CA / CA_PREVIOUS
 *
 * Hot reload:
 *   handle.setSecureContextFromDisk()
 *   or process signal via installTlsReloadSignal(handle)
 */

import http from 'node:http';
import https from 'node:https';
import { loadTlsOptions } from './tls-material.mjs';

export function createAppServer(handler) {
  const mtls = process.env.CONTROL12_MTLS === '1';
  const wantsTls = mtls || Boolean(process.env.CONTROL12_TLS_CERT);

  if (!wantsTls) {
    return {
      server: http.createServer(handler),
      mode: 'http',
      mtls: false,
      dualCa: false,
      reload: async () => ({ ok: false, reason: 'http-mode' })
    };
  }

  let material = loadTlsOptions({ mtls });
  const server = https.createServer(material.opts, handler);

  async function setSecureContextFromDisk() {
    material = loadTlsOptions({ mtls });
    server.setSecureContext(material.opts);
    return {
      ok: true,
      loadedAt: material.loadedAt,
      dualCa: material.dualCa,
      caCount: material.caCount,
      paths: material.paths
    };
  }

  return {
    server,
    mode: mtls ? 'https-mtls' : 'https',
    mtls,
    dualCa: material.dualCa,
    caCount: material.caCount,
    material,
    setSecureContextFromDisk,
    reload: setSecureContextFromDisk
  };
}

/** Reload TLS on SIGHUP (Unix). */
export function installTlsReloadSignal(handle) {
  if (!handle?.setSecureContextFromDisk) return;
  process.on('SIGHUP', () => {
    handle.setSecureContextFromDisk()
      .then(r => console.log('[tls] SIGHUP reload', JSON.stringify(r)))
      .catch(err => console.error('[tls] SIGHUP reload failed', err.message));
  });
}

export default createAppServer;
