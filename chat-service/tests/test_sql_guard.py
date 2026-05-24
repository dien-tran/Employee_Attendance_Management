from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mcp_server import _enforce_limit, validate_read_only_sql


def test_accept_select():
    ok, reason = validate_read_only_sql("SELECT * FROM staffs")
    assert ok is True
    assert reason is None


def test_accept_with_select():
    ok, reason = validate_read_only_sql(
        "WITH t AS (SELECT id FROM staffs) SELECT * FROM t"
    )
    assert ok is True
    assert reason is None


def test_reject_dml():
    ok, reason = validate_read_only_sql("DELETE FROM staffs WHERE id = 1")
    assert ok is False
    assert "read-only" in reason.lower()


def test_reject_ddl():
    ok, reason = validate_read_only_sql("DROP TABLE staffs")
    assert ok is False


def test_reject_multistatement():
    ok, reason = validate_read_only_sql("SELECT * FROM staffs; SELECT * FROM attendances")
    assert ok is False
    assert "multiple" in reason.lower()


def test_reject_comment_injection():
    ok, reason = validate_read_only_sql("SELECT * FROM staffs -- hide")
    assert ok is False
    assert "comment" in reason.lower()


def test_limit_appended_when_missing():
    sql, truncated = _enforce_limit("SELECT * FROM staffs")
    assert sql.lower().endswith("limit 50")
    assert truncated is True


def test_limit_capped_when_too_large():
    sql, truncated = _enforce_limit("SELECT * FROM staffs LIMIT 500")
    assert "limit 50" in sql.lower()
    assert truncated is True


def test_limit_kept_when_safe():
    sql, truncated = _enforce_limit("SELECT * FROM staffs LIMIT 20")
    assert sql.lower().endswith("limit 20")
    assert truncated is False
