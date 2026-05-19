from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
import unicodedata
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):  # type: ignore[no-redef]
        return False

from fastapi import FastAPI, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from logging_utils import configure_logging
from mcp_server import (
    ask_hr,
    ask_orchestrated,
    ask_wiki,
    execute_sql,
    generate_sql,
    get_db_schema,
)
from scripts.hr_etl.config import UnifiedHRConfig
from scripts.hr_etl.pipeline import run_split
from scripts.seed_mock_data import seed_if_first_run

configure_logging()
logger = logging.getLogger(__name__)
load_dotenv()

app = FastAPI(title="Chatbot HR Test API", version="1.0.0")
_BACKGROUND_ETL_TASK: asyncio.Task[None] | None = None

_TEST_MODE = "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST") is not None or os.getenv(
    "CHAT_SERVICE_TEST_MODE", "false"
).strip().lower() in {"1", "true", "yes", "on"}
_BOOTSTRAP_ENABLED = os.getenv("CHAT_SERVICE_BOOTSTRAP_ENABLED", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
} and not _TEST_MODE
_SEED_ON_STARTUP = os.getenv("MOCK_DATA_SEED_ON_STARTUP", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
_ETL_SCHEDULE_SECONDS = max(60, int(os.getenv("HR_ETL_SCHEDULE_SECONDS", "300")))

_GREETING_TOKENS = {
    "hi",
    "hello",
    "hey",
    "yo",
    "alo",
    "chao",
}
_CAPABILITY_PATTERNS = (
    "ban co the lam gi",
    "ban lam duoc gi",
    "co the giup gi",
    "co the ho tro gi",
    "giup duoc gi",
    "huong dan",
    "help",
)


async def _run_etl_once(trigger: str) -> None:
    cfg = UnifiedHRConfig()
    outputs = await asyncio.to_thread(run_split, cfg, "both")
    logger.info(
        "ETL sync completed trigger=%s staff=%s attendance=%s",
        trigger,
        outputs.get("staff"),
        outputs.get("attendance"),
    )


async def _scheduler_loop() -> None:
    while True:
        await asyncio.sleep(_ETL_SCHEDULE_SECONDS)
        try:
            await _run_etl_once(trigger="schedule")
        except Exception as exc:
            logger.exception("ETL scheduled run failed: %s", exc)


@app.on_event("startup")
async def on_startup() -> None:
    global _BACKGROUND_ETL_TASK
    if not _BOOTSTRAP_ENABLED:
        logger.info("chat-service bootstrap disabled (CHAT_SERVICE_BOOTSTRAP_ENABLED=false)")
        return

    if _SEED_ON_STARTUP:
        try:
            seeded = await asyncio.to_thread(seed_if_first_run)
            if seeded is None:
                logger.info("mock seed skipped: attendances already has data")
            else:
                logger.info(
                    "mock seed completed: inserted_staff=%s inserted_attendance=%s",
                    seeded.inserted_staff,
                    seeded.inserted_attendance,
                )
        except Exception as exc:
            logger.exception("mock seed failed: %s", exc)

    try:
        await _run_etl_once(trigger="startup")
    except Exception as exc:
        logger.exception("ETL startup run failed: %s", exc)

    _BACKGROUND_ETL_TASK = asyncio.create_task(_scheduler_loop())
    logger.info("ETL scheduler started interval_seconds=%s", _ETL_SCHEDULE_SECONDS)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    global _BACKGROUND_ETL_TASK
    task = _BACKGROUND_ETL_TASK
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    _BACKGROUND_ETL_TASK = None
    logger.info("ETL scheduler stopped")


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    context: str = ""
    topic: str = ""


class MessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: str = ""


class SQLRequest(BaseModel):
    sql: str = Field(..., min_length=1)


def _normalize_text(text: str) -> str:
    lowered = (text or "").strip().lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-z0-9\s]", " ", without_accents)
    return re.sub(r"\s+", " ", cleaned).strip()


def _static_reply_for_simple_message(message: str) -> str | None:
    normalized = _normalize_text(message)
    if not normalized:
        return None

    tokens = normalized.split()
    is_greeting = (
        normalized == "xin chao"
        or normalized in _GREETING_TOKENS
        or (len(tokens) <= 2 and all(token in _GREETING_TOKENS for token in tokens))
    )
    if is_greeting:
        return (
            "Xin chào, mình là AttendFlow Assistant. "
            "Mình có thể hỗ trợ tra cứu chấm công và thông tin nhân sự."
        )

    if any(pattern in normalized for pattern in _CAPABILITY_PATTERNS):
        return (
            "Mình có thể hỗ trợ:\n"
            "- Tra cứu chấm công theo ngày/nhân viên.\n"
            "- Xem lịch sử check-in/check-out.\n"
            "- Tra cứu thông tin nhân sự cơ bản.\n"
            "Bạn có thể thử: `Hôm nay tôi check-in lúc mấy giờ?`"
        )

    return None


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "chatbot-hr-api"}


@app.get("/schema")
def schema() -> dict[str, Any]:
    return get_db_schema()


@app.post("/generate-sql")
def generate_sql_endpoint(payload: AskRequest) -> dict[str, Any]:
    return generate_sql(question=payload.question, context=payload.context)


@app.post("/execute-sql")
def execute_sql_endpoint(payload: SQLRequest) -> dict[str, Any]:
    return execute_sql(sql=payload.sql)


@app.post("/ask")
def ask_endpoint(payload: AskRequest) -> dict[str, Any]:
    logger.info("api /ask question=%r", payload.question)
    return ask_hr(question=payload.question, context=payload.context)


@app.post("/ask-wiki")
def ask_wiki_endpoint(payload: AskRequest) -> dict[str, Any]:
    logger.info("api /ask-wiki question=%r topic=%r", payload.question, payload.topic or "auto")
    return ask_wiki(question=payload.question, context=payload.context, topic=payload.topic)


@app.post("/ask-orchestrated")
def ask_orchestrated_endpoint(payload: AskRequest) -> dict[str, Any]:
    logger.info("api /ask-orchestrated question=%r", payload.question)
    return ask_orchestrated(question=payload.question, context=payload.context)


def _error_http_code(error_code: str) -> int:
    if error_code == "forbidden":
        return 403
    if error_code in {"missing_openrouter_key", "openrouter_error"}:
        return 503
    if error_code in {"invalid_sql", "invalid_generated_sql", "invalid_scope_sql", "execution_error"}:
        return 400
    return 500


@app.post("/message")
def message_endpoint(
    payload: MessageRequest,
    x_staff_id: str | None = Header(default=None, alias="X-Staff-Id"),
    x_user_roles: str | None = Header(default=None, alias="X-User-Roles"),
) -> JSONResponse:
    logger.info("api /message staff_id=%r roles=%r", x_staff_id or "", x_user_roles or "")
    static_reply = _static_reply_for_simple_message(payload.message)
    if static_reply:
        logger.info("api /message served by static template")
        return JSONResponse(
            status_code=200,
            content={
                "code": 200,
                "message": "OK",
                "result": {
                    "reply": static_reply,
                    "selectedAgent": "template",
                    "traceId": "",
                },
            },
        )

    result = ask_orchestrated(
        question=payload.message,
        context=payload.context,
        authz={
            "staff_id": x_staff_id,
            "user_roles": x_user_roles or "",
        },
    )

    if not result.get("ok"):
        code = _error_http_code(result.get("error_code", "unknown_error"))
        return JSONResponse(
            status_code=code,
            content={
                "code": code,
                "message": result.get("message", "Chat service error"),
                "result": None,
            },
        )

    orchestration = result.get("orchestration", {})
    return JSONResponse(
        status_code=200,
        content={
            "code": 200,
            "message": "OK",
            "result": {
                "reply": result.get("answer", ""),
                "selectedAgent": orchestration.get("selected_agent", result.get("selected_agent", "unknown")),
                "traceId": orchestration.get("trace_id", result.get("trace_id", "")),
            },
        },
    )
