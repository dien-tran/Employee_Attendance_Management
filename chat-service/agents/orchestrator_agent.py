from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any

from .common import OpenRouterClient, resolve_llm_config

from .llm_wiki_agent import LLMWikiAgent, build_llm_wiki_agent
from .mysql_agent import MySQLAgent, build_mysql_agent

DEFAULT_CLASSIFIER_THRESHOLD = 0.6
logger = logging.getLogger(__name__)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


@dataclass
class OrchestratorAgent:
    """
    Route aggregate/personal questions to llm_wiki_agent/auth-db/core-db/composed.
    Fallback policy:
    - confidence < threshold -> mysql_agent
    - classifier output invalid -> mysql_agent
    - wiki execution error -> mysql_agent
    """

    mysql_agent: MySQLAgent
    wiki_agent: LLMWikiAgent
    openrouter_api_key: str
    openrouter_model: str
    openrouter_base_url: str
    classifier_threshold: float = DEFAULT_CLASSIFIER_THRESHOLD

    def _call_llm(self, prompt: str, temperature: float = 0) -> str:
        client = OpenRouterClient(
            api_key=self.openrouter_api_key,
            model=self.openrouter_model,
            base_url=self.openrouter_base_url,
        )
        return client.chat_once(prompt=prompt, temperature=temperature)

    def _build_classifier_prompt(self, question: str, context: str | None) -> str:
        context_txt = context.strip() if context else "None"
        return (
            "You are classifier for a 4-route HR chatbot router.\n"
            "Choose exactly one route:\n"
            '- "auth-db": staff/profile/department metadata from auth database.\n'
            '- "core-db": attendance/check-in/check-out records from core database.\n'
            '- "composed": question needs both staff + attendance data combined by staff_id.\n'
            '- "wiki": aggregate/summary analytics from precomputed markdown.\n\n'
            "Return strict JSON only with format:\n"
            '{"route":"wiki|auth-db|core-db|composed","confidence":0.0-1.0,"reason":"short"}\n'
            "No markdown, no extra text.\n\n"
            f"Context:\n{context_txt}\n\n"
            f"Question:\n{question}\n"
        )

    def classify(
        self,
        question: str,
        context: str | None = None,
        trace_id: str | None = None,
    ) -> dict[str, Any]:
        if not self.openrouter_api_key:
            logger.warning("[trace=%s] classifier missing OPENROUTER_API_KEY -> fallback mysql", trace_id or "-")
            return {
                "route": "core-db",
                "confidence": 0.0,
                "reason": "missing_openrouter_key",
                "source": "fallback",
            }

        prompt = self._build_classifier_prompt(question=question, context=context)
        try:
            raw = self._call_llm(prompt=prompt, temperature=0)
            parsed = json.loads(raw.strip())
            route = str(parsed.get("route", "")).strip()
            confidence = _safe_float(parsed.get("confidence", 0.0), default=0.0)
            reason = str(parsed.get("reason", "")).strip() or "n/a"
            if route not in {"wiki", "auth-db", "core-db", "composed"}:
                raise ValueError("Invalid route")
            confidence = max(0.0, min(1.0, confidence))
            logger.info(
                "[trace=%s] classifier decision route=%s confidence=%.2f reason=%r",
                trace_id or "-",
                route,
                confidence,
                reason,
            )
            return {
                "route": route,
                "confidence": confidence,
                "reason": reason,
                "source": "classifier",
            }
        except Exception as exc:
            logger.warning("[trace=%s] classifier error -> fallback mysql: %s", trace_id or "-", exc)
            return {
                "route": "core-db",
                "confidence": 0.0,
                "reason": f"classifier_error: {exc}",
                "source": "fallback",
            }

    def _with_orchestration(self, payload: dict[str, Any], meta: dict[str, Any]) -> dict[str, Any]:
        out = dict(payload)
        out["orchestration"] = meta
        return out

    def answer(
        self,
        question: str,
        context: str | None = None,
        authz: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        trace_id = uuid.uuid4().hex[:12]
        logger.info("[trace=%s] orchestrator start question=%r", trace_id, question)
        cls = self.classify(question=question, context=context, trace_id=trace_id)
        should_use_wiki = cls["route"] == "wiki" and cls["confidence"] >= self.classifier_threshold
        logger.info(
            "[trace=%s] routing threshold=%.2f should_use_wiki=%s",
            trace_id,
            self.classifier_threshold,
            should_use_wiki,
        )

        if should_use_wiki:
            wiki_result = self.wiki_agent.answer(question=question, context=context, trace_id=trace_id)
            meta = {
                "selected_agent": "wiki",
                "classifier": cls,
                "threshold": self.classifier_threshold,
                "fallback_to_mysql": False,
                "trace_id": trace_id,
            }
            if wiki_result.get("ok"):
                logger.info("[trace=%s] orchestrator completed by llm_wiki_agent", trace_id)
                return self._with_orchestration(wiki_result, meta)

            logger.warning("[trace=%s] wiki agent failed -> fallback mysql", trace_id)
            mysql_result = self.mysql_agent.answer(
                question=question,
                context=context,
                trace_id=trace_id,
                authz=authz,
            )
            return self._with_orchestration(
                mysql_result,
                {
                    "selected_agent": mysql_result.get("selected_agent", mysql_result.get("agent", "core-db")),
                    "classifier": cls,
                    "threshold": self.classifier_threshold,
                    "fallback_to_mysql": True,
                    "fallback_reason": "wiki_agent_error",
                    "wiki_error": wiki_result,
                    "trace_id": trace_id,
                },
            )

        mysql_result = self.mysql_agent.answer(
            question=question,
            context=context,
            trace_id=trace_id,
            authz=authz,
        )
        logger.info("[trace=%s] orchestrator completed by %s", trace_id, mysql_result.get("selected_agent"))
        return self._with_orchestration(
            mysql_result,
            {
                "selected_agent": mysql_result.get("selected_agent", mysql_result.get("agent", "core-db")),
                "classifier": cls,
                "threshold": self.classifier_threshold,
                "fallback_to_mysql": cls["route"] == "wiki",
                "trace_id": trace_id,
            },
        )


def build_orchestrator_agent() -> OrchestratorAgent:
    model = os.getenv("ORCHESTRATOR_MODEL", "").strip() or None
    llm = resolve_llm_config(model_override=model)
    threshold = _safe_float(os.getenv("CLASSIFIER_CONFIDENCE_THRESHOLD", "0.6"), default=0.6)
    threshold = max(0.0, min(1.0, threshold))
    return OrchestratorAgent(
        mysql_agent=build_mysql_agent(),
        wiki_agent=build_llm_wiki_agent(),
        openrouter_api_key=llm.api_key,
        openrouter_model=llm.model,
        openrouter_base_url=llm.chat_completions_url,
        classifier_threshold=threshold,
    )
