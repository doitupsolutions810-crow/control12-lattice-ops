# Architecture

```text
Operator / Dashboard / API client
  -> HMAC tenant token + scoped authorization
  -> Rate limiter and bounded HTTP router
  -> Policy + approval plane
  -> Durable DAG workflow engine
  -> Five governing agents / worker lease queue / governed plugins
  -> Artifact CAS / deployment plans / component registry / knowledge graph
  -> Hash-chained event ledger + Supabase replication
  -> Local, OCI, Kubernetes, Vercel-facing, edge, and offline domains
```

Mutating actions are tenant-scoped, audited, and capability-gated. Production deployment plans require digest-pinned images and approval thresholds. The runtime never stores provider OAuth tokens in plugin manifests; manifests contain only secret environment-variable names and host allowlists.
