from __future__ import annotations

from typing import Any
from .connectors import OperationalConnectors, ConnectorError


class OperationsPlane:
    def __init__(self, store: Any, constitution: Any, organization: Any, connectors: OperationalConnectors) -> None:
        self.store = store
        self.constitution = constitution
        self.organization = organization
        self.connectors = connectors

    def readiness(self, live: bool = False) -> dict[str, Any]:
        state = self.connectors.status(live)
        charter = self.constitution.get_active()
        return {
            "status": "ready" if charter and state["operational"] else "configuration_required",
            "constitution_active": bool(charter),
            "connectors": state,
            "required_operator_actions": [
                name for name, entry in state["connectors"].items() if not entry["configured"]
            ],
        }

    def advise_mission(self, objective: str) -> dict[str, Any]:
        charter = self.constitution.get_active()
        plan = self.connectors.openai.generate_plan(objective, charter)
        return {"advisory_only": True, "constitutional_authority": False, "plan": plan}

    def validate_expression(self, expression: str) -> dict[str, Any]:
        result = self.connectors.wolfram.query(expression)
        return {"advisory_only": True, "validation": result}

    def create_governed_mission(self, tenant_id: str, project_id: str, title: str, objective: str,
                                risk: str = "privileged", include_ai_advice: bool = False) -> dict[str, Any]:
        mission = self.organization.create_mission(tenant_id, project_id, title, objective, risk)
        advice = None
        if include_ai_advice:
            try:
                advice = self.advise_mission(objective)
            except ConnectorError as exc:
                advice = {"advisory_only": True, "available": False, "error": str(exc)}
        return {"mission": mission, "advice": advice, "execution_authorized": False}
