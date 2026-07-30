#!/usr/bin/env python3
"""Run bounded CONTROL12 v18 autonomy cycles for one or more fleet campaigns."""
from __future__ import annotations

import argparse
import json
import os
import sys
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--campaign-id")
    parser.add_argument("--url", default=os.environ.get("CONTROL12_URL", "http://127.0.0.1:8080"))
    parser.add_argument("--token-file", default=os.environ.get("CONTROL12_TOKEN_FILE", "/etc/control12/credentials/api_token"))
    parser.add_argument("--operator", default=os.environ.get("CONTROL12_OPERATOR", "autonomy-controller"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--reason", default="scheduled autonomous convergence evaluation")
    args = parser.parse_args()

    token_path = Path(args.token_file)
    if not token_path.is_file() or token_path.stat().st_size == 0:
        raise SystemExit("CONTROL12 API token file is missing or empty")
    token = token_path.read_text(encoding="utf-8").strip()

    if args.campaign_id:
        if not args.campaign_id.startswith("fleet-"):
            raise SystemExit("--campaign-id must be a CONTROL12 fleet campaign identifier")
        campaigns = [{"campaign_id": args.campaign_id, "policy": {"enabled": True}}]
    else:
        campaigns = api(args.url, token, "/v1/control12/autonomy/campaigns?enabled=true&limit=1000").get("items", [])

    results: list[dict[str, Any]] = []
    failures = 0
    for item in campaigns:
        campaign_id = item["campaign_id"]
        if item.get("campaign_status") in {"rolled_back", "canceled"}:
            results.append({"campaign_id": campaign_id, "skipped": True, "reason": "campaign closed"})
            continue
        try:
            result = api(
                args.url,
                token,
                f"/v1/control12/autonomy/campaigns/{campaign_id}/evaluate",
                "POST",
                {"dry_run": args.dry_run, "reason": args.reason},
                args.operator,
            )
            results.append({
                "campaign_id": campaign_id,
                "cycle_id": result.get("cycle_id"),
                "outcome": result.get("decision", {}).get("outcome"),
                "actions": [action.get("type") for action in result.get("decision", {}).get("actions", [])],
                "signature_valid": result.get("signature_valid"),
            })
        except Exception as exc:
            failures += 1
            results.append({"campaign_id": campaign_id, "error": str(exc)})
    print(json.dumps({"schema": "control12.autonomy-controller-run/v1", "dry_run": args.dry_run, "results": results, "failures": failures}, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as exc:
        print(f"autonomy controller failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
