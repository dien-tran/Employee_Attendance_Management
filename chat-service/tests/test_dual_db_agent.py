from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.mysql_agent import MySQLAgent


def _schema_tables():
    return {"columns": ["table_name"], "rows": [{"table_name": "x"}], "row_count": 1}


def _schema_columns():
    return {
        "columns": ["table_name", "column_name", "data_type", "is_nullable", "column_key"],
        "rows": [
            {
                "table_name": "x",
                "column_name": "staff_id",
                "data_type": "varchar",
                "is_nullable": "NO",
                "column_key": "",
            }
        ],
        "row_count": 1,
    }


def _schema_fks():
    return {"columns": [], "rows": [], "row_count": 0}


def test_core_question_uses_core_runner(monkeypatch):
    calls = {"auth": 0, "core": 0}

    def auth_runner(sql, params):
        calls["auth"] += 1
        if "information_schema.tables" in sql:
            return _schema_tables()
        if "information_schema.columns" in sql:
            return _schema_columns()
        return _schema_fks()

    def core_runner(sql, params):
        calls["core"] += 1
        if "information_schema.tables" in sql:
            return _schema_tables()
        if "information_schema.columns" in sql:
            return _schema_columns()
        if "information_schema.key_column_usage" in sql:
            return _schema_fks()
        return {
            "columns": ["staff_id", "type"],
            "rows": [{"staff_id": "NV0001", "type": "CHECK_IN"}],
            "row_count": 1,
        }

    agent = MySQLAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        run_auth_select=auth_runner,
        run_core_select=core_runner,
    )

    replies = iter(
        [
            "SELECT staff_id, type FROM attendances WHERE staff_id = 'NV0001' LIMIT 1",
            "Bạn có 1 bản ghi chấm công.",
        ]
    )
    monkeypatch.setattr(agent, "_call_llm", lambda prompt, temperature=0: next(replies))

    result = agent.answer(
        "attendance hôm nay của tôi",
        authz={"staff_id": "NV0001", "user_roles": "ROLE_USER"},
    )
    assert result["ok"] is True
    assert calls["core"] > 0
    assert calls["auth"] == 0


def test_composed_merges_core_and_auth_data(monkeypatch):
    def auth_runner(sql, params):
        if "information_schema.tables" in sql:
            return _schema_tables()
        if "information_schema.columns" in sql:
            return _schema_columns()
        if "information_schema.key_column_usage" in sql:
            return _schema_fks()
        return {
            "columns": ["staff_id", "name", "department", "position", "status", "role", "email"],
            "rows": [
                {
                    "staff_id": "NV0001",
                    "name": "Nguyen Van A",
                    "department": "IT",
                    "position": "Engineer",
                    "status": "ACTIVE",
                    "role": "USER",
                    "email": "a@example.com",
                }
            ],
            "row_count": 1,
        }

    def core_runner(sql, params):
        if "information_schema.tables" in sql:
            return _schema_tables()
        if "information_schema.columns" in sql:
            return _schema_columns()
        if "information_schema.key_column_usage" in sql:
            return _schema_fks()
        return {
            "columns": ["staff_id", "type", "date"],
            "rows": [{"staff_id": "NV0001", "type": "CHECK_IN", "date": "2026-05-17"}],
            "row_count": 1,
        }

    agent = MySQLAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        run_auth_select=auth_runner,
        run_core_select=core_runner,
    )

    replies = iter(
        [
            "SELECT staff_id, type, date FROM attendances WHERE date = '2026-05-17' LIMIT 10",
            "Nhân viên Nguyen Van A (IT) đã check-in hôm nay.",
        ]
    )
    monkeypatch.setattr(agent, "_call_llm", lambda prompt, temperature=0: next(replies))

    result = agent.answer("Nhân viên phòng IT hôm nay check-in thế nào?", authz={"user_roles": "ROLE_ADMIN"})
    assert result["ok"] is True
    assert result["domain"] == "composed"
    assert result["rows"][0]["staff_name"] == "Nguyen Van A"
    assert result["rows"][0]["department"] == "IT"


def test_non_admin_aggregate_question_is_forbidden():
    agent = MySQLAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        run_auth_select=lambda sql, params: {"columns": [], "rows": [], "row_count": 0},
        run_core_select=lambda sql, params: {"columns": [], "rows": [], "row_count": 0},
    )

    result = agent.answer(
        "Tỷ lệ đi muộn theo phòng ban tháng này là bao nhiêu?",
        authz={"staff_id": "NV0001", "user_roles": "ROLE_USER"},
    )
    assert result["ok"] is False
    assert result["error_code"] == "forbidden"
