from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.orchestrator_agent import OrchestratorAgent


class _DummyAgent:
    def __init__(self, payload):
        self.payload = payload

    def answer(self, question, context=None, trace_id=None, authz=None):
        out = dict(self.payload)
        out["received_question"] = question
        out["received_context"] = context
        out["received_trace_id"] = trace_id
        out["received_authz"] = authz
        return out


def _build_orchestrator(mysql_payload, wiki_payload, threshold=0.6):
    return OrchestratorAgent(
        mysql_agent=_DummyAgent(mysql_payload),
        wiki_agent=_DummyAgent(wiki_payload),
        openrouter_api_key="key",
        openrouter_model="mock-model",
        openrouter_base_url="https://example.com",
        classifier_threshold=threshold,
    )


def test_orchestrator_routes_to_wiki_when_confident(monkeypatch):
    orch = _build_orchestrator(
        mysql_payload={"ok": True, "agent": "mysql_agent"},
        wiki_payload={"ok": True, "agent": "llm_wiki_agent"},
    )
    monkeypatch.setattr(
        orch,
        "_call_llm",
        lambda prompt, temperature=0: '{"route":"wiki","confidence":0.91,"reason":"aggregate"}',
    )

    result = orch.answer("Tỷ lệ checkin đi muộn theo phòng ban?")
    assert result["ok"] is True
    assert result["agent"] == "llm_wiki_agent"
    assert result["orchestration"]["selected_agent"] == "wiki"
    assert result["orchestration"]["classifier"]["confidence"] == 0.91


def test_orchestrator_fallbacks_to_mysql_when_low_confidence(monkeypatch):
    orch = _build_orchestrator(
        mysql_payload={"ok": True, "agent": "mysql_agent"},
        wiki_payload={"ok": True, "agent": "llm_wiki_agent"},
    )
    monkeypatch.setattr(
        orch,
        "_call_llm",
        lambda prompt, temperature=0: '{"route":"wiki","confidence":0.42,"reason":"uncertain"}',
    )

    result = orch.answer("Cho mình tổng quan?")
    assert result["ok"] is True
    assert result["agent"] == "mysql_agent"
    assert result["orchestration"]["selected_agent"] == "mysql_agent"
    assert result["orchestration"]["fallback_to_mysql"] is True


def test_orchestrator_fallbacks_to_mysql_when_classifier_output_invalid(monkeypatch):
    orch = _build_orchestrator(
        mysql_payload={"ok": True, "agent": "mysql_agent"},
        wiki_payload={"ok": True, "agent": "llm_wiki_agent"},
    )
    monkeypatch.setattr(orch, "_call_llm", lambda prompt, temperature=0: "not-json")

    result = orch.answer("Bất kỳ câu hỏi nào")
    assert result["ok"] is True
    assert result["agent"] == "mysql_agent"
    assert result["orchestration"]["classifier"]["source"] == "fallback"
