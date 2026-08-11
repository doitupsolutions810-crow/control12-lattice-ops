# CONTROL12 GitOps / Multi-Region Progressive Delivery

This directory is the declarative deployment layer for CONTROL12 v5.

## What is real in this branch

- Argo CD `ApplicationSet` discovers registered production clusters from Argo CD cluster secrets.
- Argo Rollouts performs progressive canary delivery.
- Istio `VirtualService` weights are controlled by Argo Rollouts.
- Prometheus analysis can abort a rollout when success-rate or p95-latency gates fail.
- Workloads require immutable `sha256` image digests; mutable tags are rejected by Helm rendering.
- The existing dedicated `[self-hosted, macOS, ARM64, control12]` runner validates the chart.

## Required cluster registration metadata

Each Argo CD cluster secret selected for production must carry:

```yaml
metadata:
  labels:
    control12.io/fleet: production
    control12.io/region: us-west-2
  annotations:
    control12.io/host: control12.us-west.example.com
    control12.io/istio-gateway: control12-gateway
    control12.io/prometheus-address: http://prometheus.monitoring.svc.cluster.local:9090
```

Use the corresponding regional values for each cluster. Do not copy the example host or Prometheus address blindly; they must resolve inside the target environment.

## Required controllers

Target clusters must already have compatible versions of:

1. Argo CD + ApplicationSet controller
2. Argo Rollouts controller and CRDs
3. Istio networking CRDs/control plane
4. Prometheus with Istio request metrics if `analysis.enabled=true`

The chart does not install cluster-wide controllers. Cluster-wide lifecycle remains a separate, explicitly admitted platform operation.

## Release contract

A production release is a Git commit that changes `image.digest` to the verified immutable digest produced by the CONTROL12 build/sign/attest pipeline. The desired-state commit is then reconciled by Argo CD. CI does not call `kubectl apply`, `helm upgrade`, or the Argo CD sync API for production.

Argo CD automated sync is configured with prune and self-heal. It is not treated as an automatic rollback engine. Canary failure handling belongs to Argo Rollouts analysis; a failed AnalysisRun aborts the rollout and returns traffic to the stable ReplicaSet.

## Canary sequence

`5% -> 5m -> SLO gate -> 25% -> 5m -> SLO gate -> 50% -> 10m -> SLO gate -> 100%`

When Prometheus analysis is enabled, the default gates are:

- success rate >= 99%
- p95 request latency <= 2 seconds
- 5 measurements at 1-minute intervals
- failure after 2 failed measurements

Tune these values from evidence; do not increase autonomous remediation authority merely to force a deployment through a failing gate.

## Multi-region model

One `Application` is generated per Argo CD-registered cluster carrying `control12.io/fleet=production`. Region identity comes from cluster metadata, so the same chart can reconcile independent clusters without embedding kubeconfigs or long-lived cluster credentials in Git.

This branch deliberately does not claim that us-west/eu-central clusters, Nexus, AWS Fargate, Slack, PagerDuty, or external webhooks are active. Those integrations require live endpoint/account/identity information and should only be enabled after their trust and admission configuration is verified.
