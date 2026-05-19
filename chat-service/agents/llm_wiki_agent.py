from __future__ import annotations

import os
import re
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .common import OpenRouterClient, error_payload, resolve_llm_config

DEFAULT_STAFF_SUMMARY_PATH = "scripts/wiki_exports/attendance_analytics/staff_summary.md"
DEFAULT_ATTENDANCE_SUMMARY_PATH = "scripts/wiki_exports/attendance_analytics/attendance_summary.md"
_TOKEN_PATTERN = re.compile(r"\w+", flags=re.UNICODE)
logger = logging.getLogger(__name__)


@dataclass
class LLMWikiAgent:
    """
    LLM agent for aggregated HR questions based on precomputed wiki summary.
    """

    openrouter_api_key: str
    openrouter_model: str
    openrouter_base_url: str
    staff_summary_path: Path
    attendance_summary_path: Path
    max_context_chars: int = 50_000

    _attendance_keywords: tuple[str, ...] = (
        "chấm công",
        "checkin",
        "check-in",
        "checkout",
        "check-out",
        "đi muộn",
        "quên check-out",
        "late",
        "attendance",
        "giờ làm",
        "ca làm",
        "vào ca",
    )
    _staff_keywords: tuple[str, ...] = (
        "nhân viên",
        "nhân sự",
        "phòng ban",
        "chức danh",
        "onboard",
        "cccd",
        "tài khoản ngân hàng",
        "mật khẩu",
        "độ tuổi",
        "headcount",
    )

    def _call_llm(self, prompt: str, temperature: float = 0.2) -> str:
        client = OpenRouterClient(
            api_key=self.openrouter_api_key,
            model=self.openrouter_model,
            base_url=self.openrouter_base_url,
        )
        return client.chat_once(prompt=prompt, temperature=temperature)

    def _load_wiki_context(self, path: Path) -> str:
        if not path.exists():
            raise FileNotFoundError(f"Wiki summary file not found: {path}")
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            raise ValueError(f"Wiki summary file is empty: {path}")
        return content[: self.max_context_chars]

    def _keyword_score(self, text: str, keywords: tuple[str, ...]) -> int:
        lowered = text.lower()
        return sum(1 for kw in keywords if kw in lowered)

    def _tokenize(self, text: str) -> list[str]:
        tokens = [token.lower() for token in _TOKEN_PATTERN.findall(text.lower())]
        return [t for t in tokens if len(t) >= 3]

    def _content_score(self, question: str, wiki_context: str) -> int:
        q_tokens = set(self._tokenize(question))
        if not q_tokens:
            return 0
        context_lc = wiki_context.lower()
        return sum(1 for token in q_tokens if token in context_lc)

    def _resolve_topic(self, question: str, topic: str | None) -> tuple[str, dict[str, Any]]:
        if topic:
            normalized = topic.strip().lower()
            if normalized in {"staff", "attendance"}:
                return normalized, {"mode": "manual", "topic": normalized}
            raise ValueError("topic must be one of: staff, attendance")

        attendance_keyword_score = self._keyword_score(question, self._attendance_keywords)
        staff_keyword_score = self._keyword_score(question, self._staff_keywords)

        staff_context = self._load_wiki_context(self.staff_summary_path)
        attendance_context = self._load_wiki_context(self.attendance_summary_path)
        staff_content_score = self._content_score(question, staff_context)
        attendance_content_score = self._content_score(question, attendance_context)

        attendance_total = attendance_keyword_score * 3 + attendance_content_score
        staff_total = staff_keyword_score * 3 + staff_content_score
        resolved = "attendance" if attendance_total > staff_total else "staff"

        if attendance_total == staff_total:
            resolved = "attendance" if attendance_keyword_score > staff_keyword_score else "staff"

        return resolved, {
            "mode": "auto",
            "attendance_keyword_score": attendance_keyword_score,
            "staff_keyword_score": staff_keyword_score,
            "attendance_content_score": attendance_content_score,
            "staff_content_score": staff_content_score,
            "attendance_total": attendance_total,
            "staff_total": staff_total,
        }

    def _context_path_by_topic(self, topic: str) -> Path:
        if topic == "attendance":
            return self.attendance_summary_path
        return self.staff_summary_path

    def _build_prompt(self, question: str, wiki_context: str, context: str | None) -> str:
        context_txt = context.strip() if context else "None"
        return (
            "You are llm_wiki_agent for an HR chatbot.\n"
            "You answer aggregate/summary questions using only the provided wiki context.\n"
            "Rules:\n"
            "1) Answer in Vietnamese, concise and factual.\n"
            "2) If the answer is missing in context, say you do not have enough data.\n"
            "3) Do not invent numbers or facts outside context.\n"
            "4) If useful, cite the exact row content from context briefly.\n\n"
            f"Optional context:\n{context_txt}\n\n"
            f"Question:\n{question}\n\n"
            f"Wiki summary context:\n{wiki_context}\n"
        )

    def answer(
        self,
        question: str,
        context: str | None = None,
        topic: str | None = None,
        trace_id: str | None = None,
    ) -> dict[str, Any]:
        logger.info(
            "[trace=%s] wiki.answer start question=%r topic=%r",
            trace_id or "-",
            question,
            topic or "auto",
        )
        if not self.openrouter_api_key:
            return error_payload(
                "missing_openrouter_key",
                "OPENROUTER_API_KEY is not configured.",
            )

        try:
            resolved_topic, routing_meta = self._resolve_topic(question=question, topic=topic)
            wiki_path = self._context_path_by_topic(resolved_topic)
            wiki_context = self._load_wiki_context(wiki_path)
            logger.info(
                "[trace=%s] wiki.route topic=%s file=%s mode=%s",
                trace_id or "-",
                resolved_topic,
                wiki_path,
                routing_meta.get("mode", "n/a"),
            )
        except ValueError as exc:
            return error_payload("invalid_topic", str(exc))
        except Exception as exc:
            return error_payload("wiki_context_error", f"Failed to load wiki context: {exc}")

        prompt = self._build_prompt(question=question, wiki_context=wiki_context, context=context)
        try:
            answer = self._call_llm(prompt=prompt, temperature=0.2).strip()
        except Exception as exc:
            return error_payload("openrouter_error", f"OpenRouter call failed: {exc}")

        result = {
            "ok": True,
            "agent": "llm_wiki_agent",
            "topic": resolved_topic,
            "question": question,
            "answer": answer,
            "wiki_summary_path": str(wiki_path),
            "routing": routing_meta,
        }
        logger.info("[trace=%s] wiki.answer done topic=%s", trace_id or "-", resolved_topic)
        return result


def build_llm_wiki_agent() -> LLMWikiAgent:
    llm = resolve_llm_config()
    return LLMWikiAgent(
        openrouter_api_key=llm.api_key,
        openrouter_model=llm.model,
        openrouter_base_url=llm.chat_completions_url,
        staff_summary_path=Path(os.getenv("WIKI_STAFF_SUMMARY_PATH", DEFAULT_STAFF_SUMMARY_PATH)),
        attendance_summary_path=Path(
            os.getenv("WIKI_ATTENDANCE_SUMMARY_PATH", DEFAULT_ATTENDANCE_SUMMARY_PATH)
        ),
    )
