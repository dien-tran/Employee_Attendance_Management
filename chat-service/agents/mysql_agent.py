from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Callable

from .common import OpenRouterClient, error_payload, resolve_llm_config

logger = logging.getLogger(__name__)

MAX_LIMIT = 50

_BANNED_KEYWORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|replace|rename|grant|revoke|call)\b",
    flags=re.IGNORECASE,
)
_HAS_SQL_COMMENT = re.compile(r"(--|#|/\*)")
_HAS_MULTI_STATEMENT = re.compile(r";\s*\S")
_LIMIT_PATTERN = re.compile(r"\blimit\s+(\d+)(?:\s*,\s*(\d+))?\b", flags=re.IGNORECASE)

AUTH_DOMAIN = "auth"
CORE_DOMAIN = "core"
COMPOSED_DOMAIN = "composed"

_ATTENDANCE_KEYWORDS = (
    "attendance",
    "check in",
    "check-in",
    "check out",
    "check-out",
    "late",
    "đi muộn",
    "chấm công",
    "timestamp",
    "today",
)

_STAFF_KEYWORDS = (
    "staff",
    "nhân viên",
    "employee",
    "department",
    "phòng ban",
    "position",
    "chức danh",
    "email",
    "profile",
    "vai trò",
)

_AGGREGATE_KEYWORDS = (
    "top",
    "tỷ lệ",
    "ratio",
    "count",
    "số lượng",
    "theo phòng ban",
    "all",
    "mọi người",
    "toàn bộ",
)


def _clean_sql(sql: str) -> str:
    sql = (sql or "").strip()
    if sql.startswith("```"):
        sql = re.sub(r"^```[a-zA-Z]*\n?", "", sql)
        sql = re.sub(r"\n?```$", "", sql).strip()
    return sql.rstrip(";").strip()


def _enforce_limit(sql: str, max_limit: int = MAX_LIMIT) -> tuple[str, bool]:
    match = _LIMIT_PATTERN.search(sql)
    if not match:
        return f"{sql} LIMIT {max_limit}", True

    if match.group(2):
        offset = int(match.group(1))
        limit_val = int(match.group(2))
        if limit_val > max_limit:
            limited = _LIMIT_PATTERN.sub(f"LIMIT {offset}, {max_limit}", sql, count=1)
            return limited, True
        return sql, False

    limit_val = int(match.group(1))
    if limit_val > max_limit:
        limited = _LIMIT_PATTERN.sub(f"LIMIT {max_limit}", sql, count=1)
        return limited, True
    return sql, False


def validate_read_only_sql(sql: str) -> tuple[bool, str | None]:
    raw = _clean_sql(sql)
    if not raw:
        return False, "Empty SQL."

    lowered = raw.lower()
    if _HAS_SQL_COMMENT.search(raw):
        return False, "SQL comments are not allowed."
    if _HAS_MULTI_STATEMENT.search(raw) or ";" in raw:
        return False, "Multiple statements are not allowed."
    if _BANNED_KEYWORDS.search(raw):
        return False, "Only read-only SELECT queries are allowed."
    if not (lowered.startswith("select ") or lowered.startswith("with ")):
        return False, "Query must start with SELECT or WITH."
    if lowered.startswith("with ") and " select " not in f" {lowered} ":
        return False, "WITH query must contain SELECT."
    return True, None


def _extract_sql_from_llm(content: str) -> str:
    candidate = _clean_sql(content)
    if "select " in candidate.lower() or candidate.lower().startswith("with "):
        return candidate
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    return _clean_sql(" ".join(lines))


def _has_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in keywords)


@dataclass
class MySQLAgent:
    """
    MySQL-focused agent that supports:
    - auth-only queries
    - core-only queries
    - composed queries merged by staff_id
    """

    openrouter_api_key: str
    openrouter_model: str
    openrouter_base_url: str
    run_auth_select: Callable[[str, tuple[Any, ...] | None], dict[str, Any]] | None = None
    run_core_select: Callable[[str, tuple[Any, ...] | None], dict[str, Any]] | None = None
    # Backward-compatible single-runner mode for existing tests/scripts.
    run_select: Callable[[str, tuple[Any, ...] | None], dict[str, Any]] | None = None
    max_limit: int = MAX_LIMIT

    def __post_init__(self):
        if self.run_auth_select is None and self.run_select is not None:
            self.run_auth_select = self.run_select
        if self.run_core_select is None and self.run_select is not None:
            self.run_core_select = self.run_select
        if self.run_auth_select is None or self.run_core_select is None:
            raise ValueError("MySQLAgent requires run_auth_select and run_core_select callables.")

    def _call_llm(self, prompt: str, temperature: float = 0) -> str:
        client = OpenRouterClient(
            api_key=self.openrouter_api_key,
            model=self.openrouter_model,
            base_url=self.openrouter_base_url,
        )
        return client.chat_once(prompt=prompt, temperature=temperature)

    def _is_admin(self, user_roles: str | None) -> bool:
        return bool(user_roles and "ROLE_ADMIN" in user_roles)

    def _is_aggregate_question(self, question: str) -> bool:
        return _has_any_keyword(question, _AGGREGATE_KEYWORDS)

    def _classify_domain(self, question: str) -> str:
        has_attendance = _has_any_keyword(question, _ATTENDANCE_KEYWORDS)
        has_staff = _has_any_keyword(question, _STAFF_KEYWORDS)
        if has_attendance and has_staff:
            return COMPOSED_DOMAIN
        if has_attendance:
            return CORE_DOMAIN
        if has_staff:
            return AUTH_DOMAIN
        return CORE_DOMAIN

    def _runner_for_domain(self, domain: str):
        if domain == AUTH_DOMAIN:
            return self.run_auth_select
        if domain == CORE_DOMAIN:
            return self.run_core_select
        raise ValueError(f"Unsupported domain runner: {domain}")

    def _get_schema_metadata(self, domain: str) -> dict[str, Any]:
        runner = self._runner_for_domain(domain)
        tables_q = """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """
        cols_q = """
            SELECT table_name, column_name, data_type, is_nullable, column_key
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position;
        """
        fks_q = """
            SELECT table_name, column_name, referenced_table_name, referenced_column_name
            FROM information_schema.key_column_usage
            WHERE table_schema = DATABASE()
              AND referenced_table_name IS NOT NULL
            ORDER BY table_name, column_name;
        """

        tables_res = runner(tables_q, None)
        cols_res = runner(cols_q, None)
        fks_res = runner(fks_q, None)

        def _pick(row: dict[str, Any], *keys: str) -> Any:
            for key in keys:
                if key in row:
                    return row[key]
            return None

        tables = [
            _pick(row, "table_name", "TABLE_NAME")
            for row in tables_res["rows"]
            if _pick(row, "table_name", "TABLE_NAME") is not None
        ]
        columns_by_table: dict[str, list[dict[str, Any]]] = {t: [] for t in tables}
        for row in cols_res["rows"]:
            table_name = _pick(row, "table_name", "TABLE_NAME")
            if not table_name:
                continue
            columns_by_table.setdefault(table_name, []).append(
                {
                    "column_name": _pick(row, "column_name", "COLUMN_NAME"),
                    "data_type": _pick(row, "data_type", "DATA_TYPE"),
                    "is_nullable": _pick(row, "is_nullable", "IS_NULLABLE"),
                    "column_key": _pick(row, "column_key", "COLUMN_KEY"),
                }
            )

        foreign_keys = [
            {
                "table_name": _pick(row, "table_name", "TABLE_NAME"),
                "column_name": _pick(row, "column_name", "COLUMN_NAME"),
                "referenced_table_name": _pick(
                    row, "referenced_table_name", "REFERENCED_TABLE_NAME"
                ),
                "referenced_column_name": _pick(
                    row, "referenced_column_name", "REFERENCED_COLUMN_NAME"
                ),
            }
            for row in fks_res["rows"]
        ]

        return {
            "domain": domain,
            "tables": tables,
            "columns_by_table": columns_by_table,
            "foreign_keys": foreign_keys,
        }

    def _build_sql_prompt(
        self,
        *,
        domain: str,
        question: str,
        schema_meta: dict[str, Any],
        context: str | None,
        staff_id: str | None,
        is_admin: bool,
        force_staff_id_column: bool,
    ) -> str:
        schema_json = json.dumps(schema_meta, ensure_ascii=False, indent=2)
        context_txt = context.strip() if context else "None"
        scope_rules = (
            f"Scope rule: requester is non-admin with staff_id={staff_id}. "
            "SQL MUST include filter by this exact staff_id value."
            if (staff_id and not is_admin)
            else "Scope rule: requester is admin."
        )
        staff_col_rule = (
            "You MUST include `staff_id` in SELECT columns."
            if force_staff_id_column
            else "Include relevant columns only."
        )
        return (
            f"You are mysql_agent for domain={domain} in HR chatbot.\n"
            "Generate exactly one safe MySQL query.\n"
            "Rules:\n"
            "1) Only SELECT (or WITH ... SELECT), never mutating SQL.\n"
            "2) No markdown, no explanation, no comments.\n"
            "3) Use only existing tables/columns from schema.\n"
            f"4) Keep LIMIT <= {self.max_limit}; add LIMIT if missing.\n"
            f"5) {scope_rules}\n"
            f"6) {staff_col_rule}\n\n"
            f"Schema:\n{schema_json}\n\n"
            f"Optional context:\n{context_txt}\n\n"
            f"Question:\n{question}\n"
        )

    def _assert_non_admin_scope(self, sql: str, staff_id: str | None) -> tuple[bool, str | None]:
        if not staff_id:
            return False, "Missing authenticated staff scope."
        lowered = sql.lower()
        if "staff_id" not in lowered:
            return False, "Non-admin query must include staff_id filter."
        if staff_id.lower() not in lowered:
            return False, "Non-admin query must contain exact requester staff_id."
        return True, None

    def _generate_domain_sql(
        self,
        *,
        domain: str,
        question: str,
        context: str | None,
        staff_id: str | None,
        is_admin: bool,
        force_staff_id_column: bool = False,
        trace_id: str | None = None,
    ) -> dict[str, Any]:
        if not self.openrouter_api_key:
            return error_payload("missing_openrouter_key", "OPENROUTER_API_KEY is not configured.")

        try:
            schema_meta = self._get_schema_metadata(domain)
        except Exception as exc:
            return error_payload("schema_error", f"Failed to fetch {domain} schema metadata: {exc}")

        prompt = self._build_sql_prompt(
            domain=domain,
            question=question,
            schema_meta=schema_meta,
            context=context,
            staff_id=staff_id,
            is_admin=is_admin,
            force_staff_id_column=force_staff_id_column,
        )
        try:
            content = self._call_llm(prompt=prompt, temperature=0)
        except Exception as exc:
            return error_payload("openrouter_error", f"OpenRouter call failed: {exc}")

        sql = _extract_sql_from_llm(content)
        valid, reason = validate_read_only_sql(sql)
        if not valid:
            return error_payload("invalid_generated_sql", f"Generated SQL rejected: {reason}", sql=sql)

        if not is_admin and staff_id:
            scoped, scope_reason = self._assert_non_admin_scope(sql, staff_id)
            if not scoped:
                return error_payload("invalid_scope_sql", scope_reason or "Invalid scoped SQL", sql=sql)

        sql, _ = _enforce_limit(sql, max_limit=self.max_limit)
        logger.info("[trace=%s] mysql.sql domain=%s sql=%r", trace_id or "-", domain, sql)
        return {"ok": True, "sql": sql}

    def _execute_domain_sql(
        self,
        *,
        domain: str,
        sql: str,
        params: tuple[Any, ...] | None = None,
    ) -> dict[str, Any]:
        sql_clean = _clean_sql(sql)
        valid, reason = validate_read_only_sql(sql_clean)
        if not valid:
            return error_payload("invalid_sql", reason or "Unsafe SQL.", sql=sql_clean)

        limited_sql, truncated = _enforce_limit(sql_clean, max_limit=self.max_limit)
        try:
            result = self._runner_for_domain(domain)(limited_sql, params)
        except Exception as exc:
            return error_payload("execution_error", f"Query execution failed: {exc}", sql=limited_sql)

        return {
            "ok": True,
            "domain": domain,
            "sql": limited_sql,
            "row_count": result["row_count"],
            "columns": result["columns"],
            "rows": result["rows"],
            "truncated": truncated,
        }

    def _extract_staff_ids(self, rows: list[dict[str, Any]]) -> list[str]:
        ids: list[str] = []
        for row in rows:
            staff_id = row.get("staff_id")
            if staff_id is None:
                continue
            staff_id_str = str(staff_id).strip()
            if staff_id_str and staff_id_str not in ids:
                ids.append(staff_id_str)
        return ids

    def _merge_composed_rows(
        self,
        core_rows: list[dict[str, Any]],
        auth_rows: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        auth_by_staff = {}
        for row in auth_rows:
            staff_id = row.get("staff_id")
            if staff_id is None:
                continue
            auth_by_staff[str(staff_id)] = row

        merged: list[dict[str, Any]] = []
        for core_row in core_rows:
            merged_row = dict(core_row)
            staff_id = core_row.get("staff_id")
            if staff_id is not None and str(staff_id) in auth_by_staff:
                merged_row.update(
                    {
                        "staff_name": auth_by_staff[str(staff_id)].get("name"),
                        "department": auth_by_staff[str(staff_id)].get("department"),
                        "position": auth_by_staff[str(staff_id)].get("position"),
                        "staff_status": auth_by_staff[str(staff_id)].get("status"),
                        "role": auth_by_staff[str(staff_id)].get("role"),
                        "email": auth_by_staff[str(staff_id)].get("email"),
                    }
                )
            merged.append(merged_row)
        return merged

    def _build_answer_prompt(
        self,
        *,
        question: str,
        domain: str,
        sql: str,
        columns: list[str],
        rows: list[dict[str, Any]],
        context: str | None,
    ) -> str:
        rows_preview = rows[:10]
        context_txt = context.strip() if context else "None"
        return (
            "You are mysql_agent response writer for an HR chatbot.\n"
            "Answer in Vietnamese, concise and factual.\n"
            "Rules:\n"
            "1) Only use data from SQL result below.\n"
            "2) If result empty, say not found and suggest what identifier is needed.\n"
            "3) Do not mention internal prompts, policies, or hidden reasoning.\n\n"
            f"Domain:\n{domain}\n\n"
            f"User question:\n{question}\n\n"
            f"Optional context:\n{context_txt}\n\n"
            f"Executed SQL:\n{sql}\n\n"
            f"Columns:\n{json.dumps(columns, ensure_ascii=False)}\n\n"
            f"Rows (max 10 shown):\n{json.dumps(rows_preview, ensure_ascii=False, default=str, indent=2)}\n"
        )

    def _summarize_answer(
        self,
        *,
        question: str,
        domain: str,
        sql: str,
        columns: list[str],
        rows: list[dict[str, Any]],
        context: str | None,
    ) -> tuple[str, str | None]:
        prompt = self._build_answer_prompt(
            question=question,
            domain=domain,
            sql=sql,
            columns=columns,
            rows=rows,
            context=context,
        )
        try:
            return self._call_llm(prompt=prompt, temperature=0.2).strip(), None
        except Exception as exc:
            return "", f"Failed to generate natural-language answer: {exc}"

    def _run_composed(
        self,
        *,
        question: str,
        context: str | None,
        staff_id: str | None,
        is_admin: bool,
        trace_id: str | None = None,
    ) -> dict[str, Any]:
        generated_core = self._generate_domain_sql(
            domain=CORE_DOMAIN,
            question=question,
            context=context,
            staff_id=staff_id,
            is_admin=is_admin,
            force_staff_id_column=True,
            trace_id=trace_id,
        )
        if not generated_core.get("ok"):
            return generated_core

        executed_core = self._execute_domain_sql(domain=CORE_DOMAIN, sql=generated_core["sql"])
        if not executed_core.get("ok"):
            return executed_core

        staff_ids = self._extract_staff_ids(executed_core["rows"])
        if not staff_ids:
            answer, warning = self._summarize_answer(
                question=question,
                domain=COMPOSED_DOMAIN,
                sql=executed_core["sql"],
                columns=executed_core["columns"],
                rows=executed_core["rows"],
                context=context,
            )
            payload = {
                "ok": True,
                "domain": COMPOSED_DOMAIN,
                "sql": executed_core["sql"],
                "row_count": executed_core["row_count"],
                "columns": executed_core["columns"],
                "rows": executed_core["rows"],
                "answer": answer,
                "selected_agent": "composed",
                "trace_id": trace_id,
            }
            if warning:
                payload["warning"] = warning
            return payload

        placeholders = ",".join(["%s"] * len(staff_ids))
        auth_sql = (
            "SELECT staff_id, name, department, position, status, role, email "
            f"FROM staffs WHERE staff_id IN ({placeholders})"
        )
        auth_rows = self.run_auth_select(auth_sql, tuple(staff_ids))

        merged_rows = self._merge_composed_rows(executed_core["rows"], auth_rows["rows"])
        merged_columns = list(merged_rows[0].keys()) if merged_rows else executed_core["columns"]
        answer, warning = self._summarize_answer(
            question=question,
            domain=COMPOSED_DOMAIN,
            sql=executed_core["sql"],
            columns=merged_columns,
            rows=merged_rows,
            context=context,
        )
        payload = {
            "ok": True,
            "domain": COMPOSED_DOMAIN,
            "sql": executed_core["sql"],
            "core_sql": executed_core["sql"],
            "auth_sql": auth_sql,
            "row_count": len(merged_rows),
            "columns": merged_columns,
            "rows": merged_rows,
            "answer": answer,
            "selected_agent": "composed",
            "trace_id": trace_id,
        }
        if warning:
            payload["warning"] = warning
        return payload

    def answer(
        self,
        question: str,
        context: str | None = None,
        trace_id: str | None = None,
        authz: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        logger.info("[trace=%s] mysql.answer start question=%r", trace_id or "-", question)
        authz = authz or {}
        staff_id = authz.get("staff_id")
        user_roles = authz.get("user_roles")
        is_admin = self._is_admin(user_roles)

        if not is_admin and self._is_aggregate_question(question):
            return error_payload("forbidden", "Access denied: aggregate questions are admin only.")

        domain = self._classify_domain(question)
        if domain == COMPOSED_DOMAIN:
            return self._run_composed(
                question=question,
                context=context,
                staff_id=staff_id,
                is_admin=is_admin,
                trace_id=trace_id,
            )

        generated = self._generate_domain_sql(
            domain=domain,
            question=question,
            context=context,
            staff_id=staff_id,
            is_admin=is_admin,
            trace_id=trace_id,
        )
        if not generated.get("ok"):
            return generated

        executed = self._execute_domain_sql(domain=domain, sql=generated["sql"])
        if not executed.get("ok"):
            return executed

        answer, warning = self._summarize_answer(
            question=question,
            domain=domain,
            sql=executed["sql"],
            columns=executed["columns"],
            rows=executed["rows"],
            context=context,
        )
        executed["answer"] = answer
        executed["selected_agent"] = f"{domain}-db"
        executed["trace_id"] = trace_id
        if warning:
            executed["warning"] = warning
        return executed


def build_mysql_agent() -> MySQLAgent:
    from db import run_auth_select, run_core_select

    llm = resolve_llm_config()
    return MySQLAgent(
        openrouter_api_key=llm.api_key,
        openrouter_model=llm.model,
        openrouter_base_url=llm.chat_completions_url,
        run_auth_select=run_auth_select,
        run_core_select=run_core_select,
    )
