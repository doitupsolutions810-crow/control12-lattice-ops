#!/usr/bin/env python3
"""Shadow-evaluate CONTROL12 v19 optimization proposals without activation authority."""
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
    parser.add_argument("--proposal-id")
    parser.add_argument("--url", default=os.environ.get("CONTROL12_URL", "http://127.0.0.1:8080"))
    parser.add_argument("--token-file", default=os.environ.get("CONTROL12_TOKEN_FILE", "/etc/control12/credentials/api_token"))
    parser.add_argument("--operator", default=os.environ.get("CONTROL12_OPERATOR", "policy-optimizer"))
    parser.add_argument("--dry-run", action="store_true", default=True)
    args = parser.parse_args()

    token_path = Path(args.token_file)
    if not token_path.is_file() or token_path.stat().st_size == 0:
        raise SystemExit("CONTROL12 API token file is missing or empty")
    token = token_path.read_text(encoding="utf-8").strip()

    if args.proposal_id:
        proposals = [{"proposal_id": args.proposal_id}]
    else:
        proposals = api(args.url, token, "/v1/control12/optimization/proposals?status=pending&limit=100").get("items", [])

    results = []
    for item in proposals:
        pid = item.get("proposal_id") or item.get("id")
        try:
            result = api(
                args.url,
                token,
                f"/v1/control12/optimization/proposals/{pid}/evaluate",
                "POST",
                {"dry_run": True, "shadow": True},
                args.operator,
            )
            results.append({"proposal_id": pid, "outcome": result.get("outcome"), "signature_valid": result.get("signature_valid")})
        except Exception as exc:
            results.append({"proposal_id": pid, "error": str(exc)})

    print(json.dumps({"schema": "control12.policy-optimizer-run/v1", "results": results}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as exc:
        print(f"policy optimizer failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
