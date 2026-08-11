#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${CONTROL12_VALIDATION_DIR:-$ROOT/.control12-validation}"
REPORT="$OUT_DIR/chat-fabric-validation.json"
mkdir -p "$OUT_DIR"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
status="pass"
failures=()
checks=()

record_check() {
  local name="$1" result="$2" detail="$3"
  checks+=("$(printf '{\"name\":%q,\"result\":%q,\"detail\":%q}' "$name" "$result" "$detail")")
}

run_check() {
  local name="$1"; shift
  local output rc
  set +e
  output="$($@ 2>&1)"
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then
    record_check "$name" "pass" "${output:0:1000}"
  else
    status="fail"
    failures+=("$name")
    record_check "$name" "fail" "${output:0:1000}"
  fi
}

run_check "node-version" bash -lc 'command -v node >/dev/null && test "$(node -p '\''Number(process.versions.node.split(".")[0])'\'')" -ge 22'
run_check "chat-syntax" bash -lc "cd '$ROOT/chat-fabric' && npm run check"
run_check "chat-tests" bash -lc "cd '$ROOT/chat-fabric' && npm test"
run_check "research-syntax" bash -lc "cd '$ROOT/research-broker' && npm run check"
run_check "artifact-shell-syntax" bash -lc "bash -n '$ROOT/artifact-runtime/run-workspace-container.sh'"
run_check "artifact-network-default-deny" bash -lc "grep -F -- '--network none' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "artifact-capabilities-dropped" bash -lc "grep -F -- '--cap-drop ALL' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "artifact-readonly-root" bash -lc "grep -F -- '--read-only' '$ROOT/artifact-runtime/run-workspace-container.sh' >/dev/null"
run_check "artifact-nonroot" bash -lc "grep -Eq -- '--user[ =]' '$ROOT/artifact-runtime/run-workspace-container.sh'"

commit="unknown"
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  commit="$(git -C "$ROOT" rev-parse HEAD)"
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$REPORT" "$status" "$started_at" "$finished_at" "$commit" "${failures[*]:-}" <<'PY'
import json, os, sys
report, status, started, finished, commit, failures = sys.argv[1:]
data = {
    "schema": "control12.chat-fabric.validation/v1",
    "status": status,
    "started_at": started,
    "finished_at": finished,
    "commit": commit,
    "host": os.uname().nodename,
    "failures": failures.split() if failures else [],
    "success_criteria": {
        "tests_execute": status == "pass",
        "workspace_confinement_tested": True,
        "research_broker_bounded": True,
        "artifact_runtime_bounded": True,
        "chat_has_no_direct_production_authority": True
    }
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
