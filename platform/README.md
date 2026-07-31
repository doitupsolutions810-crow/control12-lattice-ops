# CONTROL12 Sovereign Platform v1.0.0

A dependency-minimal AI control plane that coordinates the existing CONTROL12 local agent, five governing agents, policy, workflows, artifacts, deployments, components, and operational knowledge.

## Components

- Runtime Supervisor
- Agent SDK with planner, engineer, artifact, operations, verifier
- Durable event Message Bus
- Capability and Policy Engine
- Workflow Scheduler
- Component Registry
- Knowledge Graph
- Artifact Builder
- Deployment Coordinator
- Browser dashboard and JSON API
- Docker Compose and hardened Kubernetes baseline
- GitHub, Vercel, Supabase, Figma, Replit, and OpenAI plugin manifests

## Run locally

```bash
npm run check
npm test
npm run smoke
npm start
```

Open `http://127.0.0.1:4400`.

## Full stack

```bash
export CONTROL12_PLATFORM_TOKEN="$(openssl rand -hex 32)"
docker compose up --build
```

The API remains bound to localhost by the Compose port mapping. The local-agent and model services are private to the Compose network.
