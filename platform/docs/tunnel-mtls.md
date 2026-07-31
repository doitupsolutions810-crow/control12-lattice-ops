# Origin mTLS (cloudflared → platform)

## Goal

Only cloudflared (with a client certificate) can speak to the platform origin. Random localhost scanners without the cert are rejected at TLS handshake.

## Generate lab certs

```bash
cd platform
npm run mtls:gen
# writes ~/.control12-mtls/{ca,server,client}.{pem,key}
```

## Platform

```bash
export CONTROL12_MTLS=1
export CONTROL12_TLS_CERT=$HOME/.control12-mtls/server.pem
export CONTROL12_TLS_KEY=$HOME/.control12-mtls/server.key
export CONTROL12_TLS_CA=$HOME/.control12-mtls/ca.pem
export CONTROL12_PLATFORM_TOKEN="$(openssl rand -hex 32)"
# Do not enable CHAT_OPEN on a public hostname
npm start
```

## cloudflared

In named tunnel config (`service: https://127.0.0.1:4400`):

```yaml
originRequest:
  noTLSVerify: true
  tlsClientCert: /home/YOU/.control12-mtls/client.pem
  tlsClientKey: /home/YOU/.control12-mtls/client.key
```

(`noTLSVerify` is for the *server* cert hostname in lab; pin/replace with a proper SAN in production.)

## Edge note

Cloudflare Access application policies (email, device posture, **mTLS at the edge**) are complementary and configured in the Zero Trust dashboard — not in this repo.
