# CONTROL12 OCI image

## Image

```text
ghcr.io/doitupsolutions810-crow/control12-local-agent:0.8.0
```

The image contains the CONTROL12 Node.js service. The llama.cpp model server runs as a separate service using the official image:

```text
ghcr.io/ggml-org/llama.cpp:server
```

The application container runs as UID/GID `10001`, drops all Linux capabilities in the supplied Compose stack, uses a read-only root filesystem, and persists only CONTROL12 JSONL state.

## Start the complete stack

```bash
docker compose -f compose.yaml up --build
```

The API is exposed only on localhost by default:

```text
http://127.0.0.1:4312
```

Verify:

```bash
curl -fsS http://127.0.0.1:4312/health | jq .
curl -fsS http://127.0.0.1:4312/api/capabilities | jq .
```

## Build locally

The build helper detects Docker, Podman, nerdctl, or Buildah:

```bash
./scripts/build-image.sh
```

Override the engine or tag:

```bash
CONTAINER_ENGINE=podman \
CONTROL12_IMAGE=control12-local-agent:0.8.0 \
./scripts/build-image.sh
```

## Push to GHCR from a workstation

Create a GitHub token with `write:packages`, then:

```bash
export CR_PAT='...'
export GHCR_USER='doitupsolutions810-crow'
export CONTAINER_ENGINE='docker'
./scripts/push-ghcr.sh
```

Do not commit the token or pass it as a Docker build argument.

## Automated publication

`.github/workflows/control12-image.yml` builds `linux/amd64` and `linux/arm64`, publishes version, commit, and `latest` tags, and attaches BuildKit SBOM and provenance attestations.

Published tags:

```text
ghcr.io/doitupsolutions810-crow/control12-local-agent:0.8.0
ghcr.io/doitupsolutions810-crow/control12-local-agent:sha-<commit>
ghcr.io/doitupsolutions810-crow/control12-local-agent:latest
```

Production deployment should use the digest emitted in the workflow summary:

```text
ghcr.io/doitupsolutions810-crow/control12-local-agent@sha256:<digest>
```

## Model configuration

The default model is:

```text
ggml-org/gemma-3-4b-it-GGUF:Q4_K_M
```

Override it before starting Compose:

```bash
CONTROL12_MODEL_REPO='owner/model-GGUF:quantization' \
docker compose up
```

## Security boundary

The CONTROL12 API includes a powerful terminal endpoint. The supplied Compose mapping binds it to `127.0.0.1`; do not publish the container port directly to an untrusted network. Place authentication and authorization in front of the service before any remote or multi-user deployment.
