#!/usr/bin/env python3
"""Drive one CONTROL12 v17 fleet campaign using v16 fenced deployment workers."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def api(base: str, token: str, path: str, method: str = "GET", body: dict[str, Any] | None = None, operator: str | None = None) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if operator:
        headers["X-Control12-Operator"] = operator
    request = urllib.request.Request(
        base.rstrip("/") + path,
        data=None if body is None else json.dumps(body, sort_keys=True).encode("utf-8"),
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"CONTROL12 API {exc.code}: {detail}") from exc


def pending_plan_ids(campaign: dict[str, Any]) -> list[str]:
    result: list[str] = []
    leaseable = {"pending", "drifted", "rollback_pending"}
    for wave in campaign.get("waves", []):
        plan = wave.get("plan")
        if plan and plan.get("status") in leaseable:
            result.append(plan["plan_id"])
    for report in campaign.get("drift_reports", []):
        plan = report.get("remediation_plan")
        if plan and plan.get("status") in leaseable:
            result.append(plan["plan_id"])
    return sorted(set(result))


def run_worker(repo: Path, args: argparse.Namespace, plan_id: str) -> None:
    command = [
        sys.executable,
        str(repo / "scripts/control12-deployment-worker.py"),
        "--url",
        args.url,
        "--token-file",
        args.token_file,
        "--worker-id",
        args.worker_id,
        "--lease-seconds",
        str(args.lease_seconds),
        "--rollout-timeout",
        str(args.rollout_timeout),
        "--plan-id",
        plan_id,
    ]
    result = subprocess.run(command, cwd=repo, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"deployment worker failed for {plan_id} with exit code {result.returncode}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--campaign-id", required=True)
    parser.add_argument("--url", default=os.environ.get("CONTROL12_URL", "http://127.0.0.1:8080"))
    parser.add_argument("--token-file", default=os.environ.get("CONTROL12_TOKEN_FILE", "/etc/control12/credentials/api_token"))
    parser.add_argument("--operator", default=os.environ.get("CONTROL12_OPERATOR", "fleet-controller"))
    parser.add_argument("--worker-id", default="fleet-controller-worker")
    parser.add_argument("--lease-seconds", type=int, default=300)
    parser.add_argument("--rollout-timeout", type=int, default=300)
    parser.add_argument("--interval", type=int, default=5)
    parser.add_argument("--max-cycles", type=int, default=60)
    parser.add_argument("--start", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--promote-manual", action="store_true")
    parser.add_argument("--repo", default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()

    token_path = Path(args.token_file)
    if not token_path.is_file() or token_path.stat().st_size == 0:
        raise SystemExit("CONTROL12 API token file is missing or empty")
    token = token_path.read_text(encoding="utf-8").strip()
    repo = Path(args.repo)

    campaign = api(args.url, token, f"/v1/control12/fleet/campaigns/{args.campaign_id}")
    if campaign["status"] == "proposed" and args.start:
        api(args.url, token, f"/v1/control12/fleet/campaigns/{args.campaign_id}/start", "POST", {}, args.operator)
    for cycle in range(1, args.max_cycles + 1):
        campaign = api(args.url, token, f"/v1/control12/fleet/campaigns/{args.campaign_id}")
        status = campaign["status"]
        if status in {"complete", "rolled_back", "failed", "canceled"}:
            print(json.dumps({"campaign_id": args.campaign_id, "status": status, "cycles": cycle}, sort_keys=True))
            return 0 if status in {"complete", "rolled_back"} else 1
        plans = pending_plan_ids(campaign)
        if plans and not args.execute:
            print(json.dumps({"campaign_id": args.campaign_id, "status": status, "pending_plans": plans, "execution_required": True}, sort_keys=True))
            return 3
        for plan_id in plans:
            run_worker(repo, args, plan_id)
        result = api(args.url, token, f"/v1/control12/fleet/campaigns/{args.campaign_id}/reconcile", "POST", {}, args.operator)
        campaign = result.get("campaign", result)
        if campaign.get("status") == "awaiting_promotion" and args.promote_manual:
            full = api(args.url, token, f"/v1/control12/fleet/campaigns/{args.campaign_id}")
            current = int(full["current_wave"])
            wave = next(item for item in full["waves"] if int(item["wave_index"]) == current)
            api(
                args.url,
                token,
                f"/v1/control12/fleet/campaigns/{args.campaign_id}/promote",
                "POST",
                {"expected_plan_digest": wave["plan"]["plan_digest"], "reason": "explicit fleet-controller promotion authorization"},
                args.operator,
            )
        elif campaign.get("status") == "awaiting_promotion" and not args.promote_manual:
            print(json.dumps({"campaign_id": args.campaign_id, "status": "awaiting_promotion", "manual_promotion_required": True}, sort_keys=True))
            return 4
        time.sleep(max(0, args.interval))
    print(json.dumps({"campaign_id": args.campaign_id, "status": "timeout", "cycles": args.max_cycles}, sort_keys=True))
    return 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as exc:
        print(f"fleet controller failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
