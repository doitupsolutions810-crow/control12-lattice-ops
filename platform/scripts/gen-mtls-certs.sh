#!/usr/bin/env bash
# Generate a local CA + server cert + client cert for origin mTLS (dev/lab).
# Output under ~/.control12-mtls/ (mode 700). Never commit these files.
set -euo pipefail

DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
DAYS="${CONTROL12_MTLS_DAYS:-825}"
CN_SERVER="${CONTROL12_MTLS_SERVER_CN:-control12-platform.local}"
CN_CLIENT="${CONTROL12_MTLS_CLIENT_CN:-cloudflared-origin}"

mkdir -p "$DIR"
chmod 700 "$DIR"
cd "$DIR"

if [[ -f ca.pem && -f server.pem && -f client.pem ]]; then
  echo "certs already present in $DIR (delete to regenerate)"
  ls -la "$DIR"
  exit 0
fi

openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS" -out ca.pem \
  -subj "/CN=control12-dev-ca"

openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=${CN_SERVER}"
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -out server.pem -days "$DAYS" -sha256

openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/CN=${CN_CLIENT}"
openssl x509 -req -in client.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -out client.pem -days "$DAYS" -sha256

chmod 600 ca.key server.key client.key
chmod 644 ca.pem server.pem client.pem
rm -f server.csr client.csr ca.srl

echo "generated in $DIR"
echo "export CONTROL12_MTLS=1"
echo "export CONTROL12_TLS_CERT=$DIR/server.pem"
echo "export CONTROL12_TLS_KEY=$DIR/server.key"
echo "export CONTROL12_TLS_CA=$DIR/ca.pem"
echo "# cloudflared origin client cert: $DIR/client.pem + client.key"
