#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${CONTROL12_VALIDATION_DIR:-$ROOT/.control12-validation}"
REPORT="$OUT_DIR/chat-fabric-validation.json"
RESULTS="$OUT_DIR/checks.tsv"
mkdir -p "$OUT_DIR"
: > "$RESULTS"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
status="pass"
failures=()

record_check() {
  local name="$1" result="$2" detail="$3"
  detail="${detail//$'\n'/ }"
  printf '%s\t%s\t%s\n' "$name" "$result" "${detail:0:1000}" >> "$RESULTS"
}

run_check() {
  local name="$1"; shift
  local output rc
  set +e
  output="$($@ 2>&1)"
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then
    record_check "$name" "pass" "$output"
  else
    status="fail"
    failures+=("$name")
    record_check "$name" "fail" "$output"
  fi
}

run_check "node-version" bash -lc 'command -v node >/dev/null && test "$(node -p '\''Number(process.versions.node.split(".")[0])'\'')" -ge 22'
run_check "chat-syntax" bash -lc "cd '$ROOT/chat-fabric' && npm run check"
run_check "chat-tests" bash -lc "cd '$ROOT/chat-fabric' && npm test"
run_check "gateway-signature-required" bash -lc "grep -F 'CONTROL12_GATEWAY_SECRET is required when chat fabric binds beyond loopback' '$ROOT/chat-fabric/src/server.mjs' >/dev/null && grep -F 'createHmac(\"sha256\"' '$ROOT/chat-fabric/src/server.mjs' >/dev/null && grep -F 'identitySource: \"signed-gateway\"' '$ROOT/chat-fabric/src/server.mjs' >/dev/null"
run_check "research-syntax" bash -lc "cd '$ROOT/research-broker' && npm run check"
run_check "research-dns-pin" bash -lc "grep -F 'lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family)' '$ROOT/research-broker/src/server.mjs' >/dev/null && grep -F 'servername: url.hostname' '$ROOT/research-broker/src/server.mjs' >/dev/null"
run_check "research-request-bounded" bash -lc "grep -F 'MAX_REQUEST_BYTES' '$ROOT/research-broker/src/server.mjs' >/dev/null && grep -F 'MAX_BYTES' '$ROOT/research-broker/src/server.mjs' >/dev/null"
run_check "artifact-shell-syntax" bash -lc "bash -n '$ROOT/artifact-runtime/run-workspace-container.sh'"
run_check "artifact-network-default-deny" bash -lc "grep -F -- '--network none' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "artifact-capabilities-dropped" bash -lc "grep -F -- '--cap-drop ALL' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "artifact-readonly-root" bash -lc "grep -F -- '--read-only' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "artifact-nonroot" bash -lc "grep -Eq -- '--user[ =]' '$ROOT/artifact-runtime/run-workspace-container.sh'"
run_check "artifact-workspace-only-mount" bash -lc "grep -F -- 'dst=/workspace,rw' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null && grep -F -- 'src=\$TARGET' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "production-authority-denied" bash -lc "grep -F 'production.execute' '$ROOT/chat-fabric/src/policy.mjs' >/dev/null && grep -F 'HARD_DENY' '$ROOT/chat-fabric/src/policy.mjs' >/dev/null && grep -F 'productionAuthority: false' '$ROOT/chat-fabric/src/server.mjs' >/dev/null"
run_check "reconciler-shell-syntax" bash -lc "bash -n '$ROOT/scripts/control12-reconciler.sh'"
run_check "reconciler-validates-before-promote" bash -lc "grep -F 'bash \"$VALIDATOR\"' '$ROOT/scripts/control12-reconciler.sh' >/dev/null && grep -F 'promotion denied' '$ROOT/scripts/control12-reconciler.sh' >/dev/null && grep -F 'CONTROL12_VALIDATED_SHA' '$ROOT/scripts/control12-reconciler.sh' >/dev/null"
run_check "copilot-adapter-shell-syntax" bash -lc "bash -n '$ROOT/scripts/control12-copilot-workspace.sh'"
run_check "copilot-adapter-no-yolo" bash -lc "! grep -Eq -- '--allow-all|--allow-all-paths|--allow-all-urls|--yolo' '$ROOT/scripts/control12-copilot-workspace.sh'"
run_check "copilot-adapter-denies-infra" bash -lc "grep -F -- \"--deny-tool='shell(kubectl:*)'\" '$ROOT/scripts/control12-copilot-workspace.sh' >/dev/null && grep -F -- \"--deny-tool='shell(terraform:*)'\" '$ROOT/scripts/control12-copilot-workspace.sh' >/dev/null && grep -F -- \"--deny-tool='shell(aws:*)'\" '$ROOT/scripts/control12-copilot-workspace.sh' >/dev/null"

commit="unknown"
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  commit="$(git -C "$ROOT" rev-parse HEAD)"
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$REPORT" "$RESULTS" "$status" "$started_at" "$finished_at" "$commit" <<'PY'
import json, os, sys
report, results_file, status, started, finished, commit = sys.argv[1:]
checks = []
with open(results_file, encoding="utf-8") as f:
    for line in f:
        name, result, detail = line.rstrip("\n").split("\t", 2)
        checks.append({"name": name, "result": result, "detail": detail})
by_name = {c["name"]: c["result"] == "pass" for c in checks}
criteria = {
    "tests_execute": by_name.get("chat-tests", False),
    "workspace_confinement_holds": by_name.get("chat-tests", False),
    "identity_boundary_holds": by_name.get("gateway-signature-required", False),
    "research_broker_bounded": all(by_name.get(k, False) for k in (
        "research-syntax", "research-dns-pin", "research-request-bounded"
    )),
    "artifact_runtime_default_deny": all(by_name.get(k, False) for k in (
        "artifact-network-default-deny",
        "artifact-capabilities-dropped",
        "artifact-readonly-root",
        "artifact-nonroot",
        "artifact-workspace-only-mount",
    )),
    "chat_has_no_direct_production_authority": by_name.get("production-authority-denied", False),
    "pull_reconciler_is_validation_gated": all(by_name.get(k, False) for k in (
        "reconciler-shell-syntax", "reconciler-validates-before-promote"
    )),
    "copilot_cli_is_workspace_bounded": all(by_name.get(k, False) for k in (
        "copilot-adapter-shell-syntax", "copilot-adapter-no-yolo", "copilot-adapter-denies-infra"
    )),
}
data = {
    "schema": "control12.chat-fabric.validation/v1",
    "status": status,
    "started_at": started,
    "finished_at": finished,
    "commit": commit,
    "host": os.uname().nodename,
    "checks": checks,
    "success_criteria": criteria,
    "success": status == "pass" and all(criteria.values()),
}
with open(report, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, sort_keys=True)
    f.write("\n")
PY

sha="$(shasum -a 256 "$REPORT" | awk '{print $1}')"
echo "CONTROL12 validation: $status"
echo "report=$REPORT"
echo "sha256=$sha"

if [ "$status" != "pass" ]; then
  printf 'failed checks: %s\n' "${failures[*]}" >&2
  exit 1
fi
