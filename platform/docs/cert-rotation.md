# mTLS certificate rotation automation

## Rotate when near expiry (default: &lt; 60 days remaining)

```bash
cd platform
npm run mtls:rotate
# CONTROL12_MTLS_MAX_AGE_DAYS=30 npm run mtls:rotate
```

## Force rotate now

```bash
npm run mtls:rotate -- --force
# or: bash scripts/rotate-mtls-certs.sh --force
```

## What it does

1. Backs up current PEMs/keys to `~/.control12-mtls/backup-<UTC>/`
2. Regenerates CA, server, and client certs
3. Writes `last-rotation.json`
4. Prints restart instructions

## After rotation

```bash
# Platform
export CONTROL12_MTLS=1
export CONTROL12_TLS_CERT=$HOME/.control12-mtls/server.pem
export CONTROL12_TLS_KEY=$HOME/.control12-mtls/server.key
export CONTROL12_TLS_CA=$HOME/.control12-mtls/ca.pem
# restart platform process

# cloudflared: point tlsClientCert/Key at new client.pem / client.key and restart
npm run tunnel:named
```

## Cron example (weekly check)

```cron
0 4 * * 1  cd /path/to/platform && CONTROL12_MTLS_MAX_AGE_DAYS=60 bash scripts/rotate-mtls-certs.sh >>/var/log/c12-mtls-rotate.log 2>&1
```
