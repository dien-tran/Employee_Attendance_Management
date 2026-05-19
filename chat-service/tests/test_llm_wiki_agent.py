from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.llm_wiki_agent import LLMWikiAgent


def test_answer_success_loads_wiki_context(monkeypatch, tmp_path):
    staff_file = tmp_path / "staff_summary.md"
    staff_file.write_text(
        "| level | group | question | answer | details |\n"
        "| M2 | Test | Q | A | { department=IT, active_staff_count=12 } |\n",
        encoding="utf-8",
    )
    attendance_file = tmp_path / "attendance_summary.md"
    attendance_file.write_text(
        "| level | group | question | answer | details |\n"
        "| M2 | Test | Q | A | { department=IT, late_ratio_pct=66.67% } |\n",
        encoding="utf-8",
    )

    agent = LLMWikiAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        staff_summary_path=staff_file,
        attendance_summary_path=attendance_file,
    )

    captured = {"prompt": ""}

    def _mock_call(prompt, temperature=0.2):
        captured["prompt"] = prompt
        return "Phòng IT đang có 12 nhân viên active."

    monkeypatch.setattr(agent, "_call_llm", _mock_call)
    result = agent.answer("Phòng nào active nhiều nhất?")

    assert result["ok"] is True
    assert result["agent"] == "llm_wiki_agent"
    assert result["topic"] == "staff"
    assert "12 nhân viên active" in result["answer"]
    assert "department=IT" in captured["prompt"]


def test_answer_returns_error_when_wiki_file_missing():
    missing_file = Path("/tmp/not_found_attendance_summary.md")
    agent = LLMWikiAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        staff_summary_path=missing_file,
        attendance_summary_path=missing_file,
    )

    result = agent.answer("Tổng hợp tình hình chấm công?")
    assert result["ok"] is False
    assert result["error_code"] == "wiki_context_error"


def test_answer_routes_to_attendance_context(monkeypatch, tmp_path):
    staff_file = tmp_path / "staff_summary.md"
    staff_file.write_text("staff", encoding="utf-8")
    attendance_file = tmp_path / "attendance_summary.md"
    attendance_file.write_text("attendance details", encoding="utf-8")

    agent = LLMWikiAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        staff_summary_path=staff_file,
        attendance_summary_path=attendance_file,
    )

    monkeypatch.setattr(agent, "_call_llm", lambda prompt, temperature=0.2: "ok")
    result = agent.answer("Tỷ lệ checkin đi muộn tháng này?")
    assert result["ok"] is True
    assert result["topic"] == "attendance"
    assert result["wiki_summary_path"].endswith("attendance_summary.md")


def test_answer_honors_manual_topic_override(monkeypatch, tmp_path):
    staff_file = tmp_path / "staff_summary.md"
    staff_file.write_text("staff context", encoding="utf-8")
    attendance_file = tmp_path / "attendance_summary.md"
    attendance_file.write_text("attendance context", encoding="utf-8")

    agent = LLMWikiAgent(
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        staff_summary_path=staff_file,
        attendance_summary_path=attendance_file,
    )

    monkeypatch.setattr(agent, "_call_llm", lambda prompt, temperature=0.2: "ok")
    result = agent.answer("Biến động nhân sự theo phòng ban?", topic="attendance")
    assert result["ok"] is True
    assert result["topic"] == "attendance"
    assert result["routing"]["mode"] == "manual"
