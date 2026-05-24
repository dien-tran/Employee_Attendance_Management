from __future__ import annotations

import logging
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):  # type: ignore[no-redef]
        return False

from agents.mysql_agent import (
    _enforce_limit,
    build_mysql_agent,
    validate_read_only_sql,
)
from agents.llm_wiki_agent import build_llm_wiki_agent
from agents.orchestrator_agent import build_orchestrator_agent
from logging_utils import configure_logging

configure_logging()
logger = logging.getLogger(__name__)
load_dotenv()

try:
    from fastmcp import FastMCP
except ImportError:
    FastMCP = None

_AGENT_CACHE: dict[str, Any] = {}


def _get_mysql_agent():
    if "mysql" not in _AGENT_CACHE:
        _AGENT_CACHE["mysql"] = build_mysql_agent()
    return _AGENT_CACHE["mysql"]


def _get_wiki_agent():
    if "wiki" not in _AGENT_CACHE:
        _AGENT_CACHE["wiki"] = build_llm_wiki_agent()
    return _AGENT_CACHE["wiki"]


def _get_orchestrator_agent():
    if "orchestrator" not in _AGENT_CACHE:
        _AGENT_CACHE["orchestrator"] = build_orchestrator_agent()
    return _AGENT_CACHE["orchestrator"]


if FastMCP is not None:
    mcp = FastMCP("chatbot-hr-db")
else:
    mcp = None


def get_db_schema() -> dict[str, Any]:
    """Return DB metadata (tables, columns, FKs) for prompting/query planning."""
    try:
        return {"ok": True, "schema": _get_mysql_agent().get_schema_metadata()}
    except Exception as exc:
        return {
            "ok": False,
            "error_code": "schema_error",
            "message": f"Failed to read schema: {exc}",
        }


def generate_sql(question: str, context: str = "") -> dict[str, Any]:
    """mysql_agent: generate safe read-only SQL from natural language."""
    return _get_mysql_agent().generate_sql(question=question, context=context or None)


def execute_sql(sql: str) -> dict[str, Any]:
    """mysql_agent: validate and execute read-only SQL with LIMIT guard."""
    return _get_mysql_agent().execute_sql(sql=sql)


def ask_hr(question: str, context: str = "") -> dict[str, Any]:
    """
    mysql_agent end-to-end:
    - generate SQL
    - execute SQL
    - return natural-language answer + raw rows
    """
    logger.info("ask_hr received question=%r", question)
    return _get_mysql_agent().answer(question=question, context=context or None)


def ask_wiki(question: str, context: str = "", topic: str = "") -> dict[str, Any]:
    """
    llm_wiki_agent:
    - load attendance_summary markdown
    - answer aggregate question from wiki context
    """
    logger.info("ask_wiki received question=%r topic=%r", question, topic or "auto")
    return _get_wiki_agent().answer(
        question=question,
        context=context or None,
        topic=topic or None,
    )


def ask_orchestrated(
    question: str,
    context: str = "",
    authz: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    orchestrator:
    - classify question with LLM
    - if llm_wiki_agent confidence >= threshold then use wiki agent
    - otherwise fallback to mysql_agent
    """
    logger.info("ask_orchestrated received question=%r", question)
    return _get_orchestrator_agent().answer(
        question=question,
        context=context or None,
        authz=authz,
    )


if mcp is not None:
    mcp.tool(get_db_schema)
    mcp.tool(generate_sql)
    mcp.tool(execute_sql)
    mcp.tool(ask_hr)
    mcp.tool(ask_wiki)
    mcp.tool(ask_orchestrated)


if __name__ == "__main__":
    if mcp is None:
        raise RuntimeError("fastmcp is required. Install it with: pip install fastmcp")
    mcp.run()
