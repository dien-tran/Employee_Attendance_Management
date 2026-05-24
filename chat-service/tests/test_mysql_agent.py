from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.mysql_agent import MySQLAgent


def _fake_run_select(sql: str, params):
    assert params is None
    if "information_schema.tables" in sql:
        return {"columns": ["table_name"], "rows": [{"table_name": "staffs"}], "row_count": 1}
    if "information_schema.columns" in sql:
        return {
            "columns": ["table_name", "column_name", "data_type", "is_nullable", "column_key"],
            "rows": [
                {
                    "table_name": "staffs",
                    "column_name": "id",
                    "data_type": "bigint",
                    "is_nullable": "NO",
                    "column_key": "PRI",
                },
                {
                    "table_name": "staffs",
                    "column_name": "full_name",
                    "data_type": "varchar",
                    "is_nullable": "NO",
                    "column_key": "",
                },
            ],
            "row_count": 2,
        }
    if "information_schema.key_column_usage" in sql:
        return {"columns": [], "rows": [], "row_count": 0}
    return {
        "columns": ["id", "full_name"],
        "rows": [{"id": 1, "full_name": "Nguyen Van A"}],
        "row_count": 1,
    }


def test_answer_full_flow_success(monkeypatch):
    agent = MySQLAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        run_select=_fake_run_select,
    )

    replies = iter(
        [
            "SELECT id, full_name FROM staffs LIMIT 1",
            "Nhân viên có ID 1 là Nguyen Van A.",
        ]
    )

    monkeypatch.setattr(agent, "_call_llm", lambda prompt, temperature=0: next(replies))

    result = agent.answer("Thông tin nhân viên ID 1 là gì?")
    assert result["ok"] is True
    assert result["sql"] == "SELECT id, full_name FROM staffs LIMIT 1"
    assert result["row_count"] == 1
    assert result["rows"][0]["full_name"] == "Nguyen Van A"
    assert result["answer"] == "Nhân viên có ID 1 là Nguyen Van A."


def test_answer_keeps_data_when_summary_fails(monkeypatch):
    agent = MySQLAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        run_select=_fake_run_select,
    )

    calls = {"n": 0}

    def _mock_call(prompt, temperature=0):
        calls["n"] += 1
        if calls["n"] == 1:
            return "SELECT id, full_name FROM staffs LIMIT 1"
        raise RuntimeError("llm unavailable")

    monkeypatch.setattr(agent, "_call_llm", _mock_call)

    result = agent.answer("Thông tin nhân viên ID 1 là gì?")
    assert result["ok"] is True
    assert result["row_count"] == 1
    assert result["answer"] == ""
    assert "warning" in result

