from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from typing import Any


class ConnectorError(RuntimeError):
    pass


@dataclass(frozen=True)
class ConnectorResult:
    name: str
    configured: bool
    reachable: bool
    latency_ms: int | None
    detail: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _request(url: str, *, method: str = "GET", headers: dict[str, str] | None = None,
             body: dict[str, Any] | None = None, timeout: float = 8.0) -> tuple[int, bytes, int]:
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, response.read(), int((time.monotonic() - started) * 1000)
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        raise ConnectorError(f"HTTP {exc.code}: {payload[:400].decode('utf-8', 'replace')}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ConnectorError(str(exc)) from exc


class GitHubConnector:
    def __init__(self) -> None:
        self.repository = os.getenv("AVRONE_GITHUB_REPOSITORY", "doitupsolutions810-crow/control12-lattice-ops")
        self.token = os.getenv("GITHUB_TOKEN", "")

    def status(self, live: bool = False) -> ConnectorResult:
        configured = bool(self.repository)
        if not live:
            return ConnectorResult("github", configured, False, None, {"repository": self.repository, "mode": "configured"})
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "avrone-sovereign-fabric/1.5"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            code, raw, latency = _request(f"https://api.github.com/repos/{self.repository}", headers=headers)
            doc = json.loads(raw)
            return ConnectorResult("github", configured, code == 200, latency, {
                "repository": doc.get("full_name", self.repository),
                "private": doc.get("private"),
                "default_branch": doc.get("default_branch"),
                "permissions": doc.get("permissions", {}),
            })
        except ConnectorError as exc:
            return ConnectorResult("github", configured, False, None, {"repository": self.repository, "error": str(exc)})


class SupabaseConnector:
    def __init__(self) -> None:
        self.project_ref = os.getenv("SUPABASE_PROJECT_REF", "cgpztofnwwopzakygojw")
        self.url = os.getenv("SUPABASE_URL", f"https://{self.project_ref}.supabase.co")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")

    def status(self, live: bool = False) -> ConnectorResult:
        configured = bool(self.url and self.project_ref)
        detail = {"project_ref": self.project_ref, "url": self.url, "key_present": bool(self.key)}
        if not live or not self.key:
            detail["mode"] = "configured" if configured else "missing"
            return ConnectorResult("supabase", configured, False, None, detail)
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Accept": "application/json"}
        try:
            code, raw, latency = _request(
                f"{self.url.rstrip('/')}/rest/v1/control12_fabric_workflows?select=tenant_id,workflow_id,status&limit=1",
                headers=headers,
            )
            rows = json.loads(raw)
            detail.update({"rest_status": code, "sample_rows": len(rows) if isinstance(rows, list) else None})
            return ConnectorResult("supabase", configured, code == 200, latency, detail)
        except ConnectorError as exc:
            detail["error"] = str(exc)
            return ConnectorResult("supabase", configured, False, None, detail)


class OpenAIConnector:
    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.model = os.getenv("OPENAI_MODEL", "gpt-5")

    def status(self, live: bool = False) -> ConnectorResult:
        configured = bool(self.api_key)
        if not live or not configured:
            return ConnectorResult("openai", configured, False, None, {"model": self.model, "key_present": configured})
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        try:
            code, raw, latency = _request("https://api.openai.com/v1/responses", method="POST", headers=headers,
                body={"model": self.model, "input": "Return exactly: AVRONE_READY", "max_output_tokens": 16})
            doc = json.loads(raw)
            text = doc.get("output_text")
            if not text:
                chunks = []
                for item in doc.get("output", []):
                    for content in item.get("content", []):
                        if content.get("type") == "output_text":
                            chunks.append(content.get("text", ""))
                text = "".join(chunks)
            return ConnectorResult("openai", configured, code == 200, latency, {"model": self.model, "response_id": doc.get("id"), "probe": text})
        except ConnectorError as exc:
            return ConnectorResult("openai", configured, False, None, {"model": self.model, "error": str(exc)})

    def generate_plan(self, objective: str, constitution: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ConnectorError("OPENAI_API_KEY is not configured")
        schema = {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "steps": {"type": "array", "items": {"type": "object", "properties": {
                    "name": {"type": "string"}, "action": {"type": "string"}, "risk": {"type": "string"},
                    "requires_human_approval": {"type": "boolean"}}, "required": ["name", "action", "risk", "requires_human_approval"], "additionalProperties": False}},
                "constitutional_checks": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["summary", "steps", "constitutional_checks"],
            "additionalProperties": False,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        body = {
            "model": self.model,
            "instructions": "You are Avrone's planning adviser. Propose bounded, reversible steps. Never authorize execution. Return JSON only.",
            "input": json.dumps({"objective": objective, "constitution": constitution}, separators=(",", ":")),
            "text": {"format": {"type": "json_schema", "name": "governed_plan", "schema": schema, "strict": True}},
        }
        _, raw, _ = _request("https://api.openai.com/v1/responses", method="POST", headers=headers, body=body, timeout=30)
        doc = json.loads(raw)
        text = doc.get("output_text", "")
        if not text:
            text = "".join(content.get("text", "") for item in doc.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text")
        return json.loads(text)


class WolframConnector:
    def __init__(self) -> None:
        self.app_id = os.getenv("WOLFRAM_APP_ID", "")

    def status(self, live: bool = False) -> ConnectorResult:
        configured = bool(self.app_id)
        if not live or not configured:
            return ConnectorResult("wolfram", configured, False, None, {"app_id_present": configured})
        try:
            query = urllib.parse.urlencode({"appid": self.app_id, "input": "2+2", "output": "json"})
            code, raw, latency = _request(f"https://api.wolframalpha.com/v2/query?{query}")
            doc = json.loads(raw)
            return ConnectorResult("wolfram", configured, code == 200, latency, {"success": doc.get("queryresult", {}).get("success")})
        except ConnectorError as exc:
            return ConnectorResult("wolfram", configured, False, None, {"error": str(exc)})

    def query(self, expression: str) -> dict[str, Any]:
        if not self.app_id:
            raise ConnectorError("WOLFRAM_APP_ID is not configured")
        query = urllib.parse.urlencode({"appid": self.app_id, "input": expression, "output": "json"})
        _, raw, _ = _request(f"https://api.wolframalpha.com/v2/query?{query}", timeout=20)
        doc = json.loads(raw).get("queryresult", {})
        pods = []
        for pod in doc.get("pods", []):
            texts = [sub.get("plaintext", "") for sub in pod.get("subpods", []) if sub.get("plaintext")]
            if texts:
                pods.append({"title": pod.get("title"), "plaintext": texts})
        return {"success": doc.get("success", False), "input": expression, "pods": pods}


class OperationalConnectors:
    def __init__(self) -> None:
        self.github = GitHubConnector()
        self.supabase = SupabaseConnector()
        self.openai = OpenAIConnector()
        self.wolfram = WolframConnector()

    def status(self, live: bool = False) -> dict[str, Any]:
        results = [self.github.status(live), self.supabase.status(live), self.openai.status(live), self.wolfram.status(live)]
        return {"live_probe": live, "connectors": {result.name: result.as_dict() for result in results},
                "operational": all(result.configured for result in results),
                "reachable": all(result.reachable for result in results if result.configured) if live else None}
