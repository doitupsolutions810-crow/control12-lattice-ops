# CONTROL12 Chat + Coding Workspace Fabric v0.1

This service turns the custom chatbot into a governed interface to CONTROL12 workspaces, memory, research requests, artifact builds, and the v5 control plane.

## Flow

`USER -> CHAT API -> CONTEXT ASSEMBLER -> WORKSPACE/MEMORY -> TOOL REQUEST -> V5 POLICY -> EXECUTION BROKER -> EVIDENCE -> ATTESTATION`

The chatbot does not receive production credentials and does not directly mutate production. Production-changing actions cross the existing CONTROL12 v5 intent/policy/admission boundary.

## Workspace

Each tenant/workspace is rooted under `CONTROL12_WORKSPACE_ROOT` (default `~/.control12/workspaces`):

```text
{tenant}/{workspace_id}/
  source/
  generated/
  artifacts/
  attestations/
  execution/revisions.jsonl
  logs/
  memory/{scope}.jsonl
  workspace.manifest.json
```

Every file write emits a SHA-256 revision record. Paths are resolved under the workspace root and traversal outside it is rejected.

## API

The server binds to `127.0.0.1:4320` by default.

Headers:
- `X-Control12-Tenant`
- `X-Control12-Workspace`
- `X-Control12-Role`
- `X-Control12-Actor`

Endpoints:
- `GET /health`
- `GET /v1/capabilities`
- `GET /v1/workspace`
- `POST /v1/files/write`
- `POST /v1/files/read`
- `POST /v1/memory/append`
- `GET /v1/memory?scope=workspace&limit=50`
- `POST /v1/chat/context`
- `POST /v1/research`
- `POST /v1/artifacts`

`/v1/research` and `/v1/artifacts` create governed requests. They deliberately do not fabricate live network access or container execution. Those requests are consumed by separately authorized tool and artifact-runtime brokers.

## Coding workspace contract

The coding agent can read/write workspace files and request workspace-confined tool execution. It cannot read secrets, modify policy, or execute production changes. Artifact publication is staged before production admission.

## Server/VM integration

On a CONTROL12 host, run this service next to the local model/runtime and route external users through an authenticated gateway. The host OS/fabric owns configuration management, workspace volume mounts, container/VM scheduling, network egress policy, artifact quarantine, and production admission.

Recommended server boundary:

```text
Authenticated UI
  -> API Gateway / tenant identity
  -> Chat Workspace Fabric
      -> local/remote model provider
      -> Workspace volume
      -> Memory store
      -> Research Tool Broker (egress allowlist)
      -> Artifact Runtime Broker (container/VM sandbox)
      -> CONTROL12 v5 intent/policy engine
          -> staging/prod deployment fabric
          -> evidence + attestation ledger
```

## Run

```bash
cd chat-fabric
npm run check
npm test
npm start
```

This is the application-plane foundation. Network research, sandboxed artifact execution, identity provider integration, and durable distributed memory are explicit next brokers rather than implicit host privileges.
