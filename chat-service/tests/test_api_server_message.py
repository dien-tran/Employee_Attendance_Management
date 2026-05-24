from pathlib import Path
import sys

import pytest

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import api_server


def test_message_endpoint_static_greeting_does_not_call_orchestrator(monkeypatch):
    called = {"count": 0}

    def _unexpected_call(question, context="", authz=None):
        called["count"] += 1
        return {"ok": True, "answer": "should-not-be-used"}

    monkeypatch.setattr(api_server, "ask_orchestrated", _unexpected_call)
    client = TestClient(api_server.app)

    response = client.post("/message", json={"message": "Hi"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200
    assert payload["result"]["selectedAgent"] == "template"
    assert "Xin chào" in payload["result"]["reply"]
    assert called["count"] == 0


def test_message_endpoint_static_capability_does_not_call_orchestrator(monkeypatch):
    called = {"count": 0}

    def _unexpected_call(question, context="", authz=None):
        called["count"] += 1
        return {"ok": True, "answer": "should-not-be-used"}

    monkeypatch.setattr(api_server, "ask_orchestrated", _unexpected_call)
    client = TestClient(api_server.app)

    response = client.post("/message", json={"message": "Bạn có thể làm gì?"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200
    assert payload["result"]["selectedAgent"] == "template"
    assert "Mình có thể hỗ trợ" in payload["result"]["reply"]
    assert called["count"] == 0


def test_message_endpoint_success(monkeypatch):
    monkeypatch.setattr(
        api_server,
        "ask_orchestrated",
        lambda question, context="", authz=None: {
            "ok": True,
            "answer": "Xin chào",
            "selected_agent": "core-db",
            "trace_id": "abc123",
            "orchestration": {
                "selected_agent": "core-db",
                "trace_id": "abc123",
            },
        },
    )
    client = TestClient(api_server.app)

    response = client.post(
        "/message",
        json={"message": "Hello"},
        headers={"X-Staff-Id": "NV0001", "X-User-Roles": "ROLE_USER"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200
    assert payload["result"]["reply"] == "Xin chào"
    assert payload["result"]["selectedAgent"] == "core-db"


def test_message_endpoint_forbidden(monkeypatch):
    monkeypatch.setattr(
        api_server,
        "ask_orchestrated",
        lambda question, context="", authz=None: {
            "ok": False,
            "error_code": "forbidden",
            "message": "Access denied",
        },
    )
    client = TestClient(api_server.app)

    response = client.post("/message", json={"message": "Top người đi muộn"})
    assert response.status_code == 403
    payload = response.json()
    assert payload["code"] == 403
    assert payload["result"] is None


def test_message_endpoint_openrouter_error(monkeypatch):
    monkeypatch.setattr(
        api_server,
        "ask_orchestrated",
        lambda question, context="", authz=None: {
            "ok": False,
            "error_code": "openrouter_error",
            "message": "OpenRouter unavailable",
        },
    )
    client = TestClient(api_server.app)

    response = client.post("/message", json={"message": "Hôm nay tôi đi làm thế nào?"})
    assert response.status_code == 503
    payload = response.json()
    assert payload["code"] == 503
    assert payload["result"] is None


def test_message_endpoint_unknown_error_defaults_to_500(monkeypatch):
    monkeypatch.setattr(
        api_server,
        "ask_orchestrated",
        lambda question, context="", authz=None: {
            "ok": False,
            "error_code": "unexpected_error",
            "message": "Something went wrong",
        },
    )
    client = TestClient(api_server.app)

    response = client.post("/message", json={"message": "Test"})
    assert response.status_code == 500
    payload = response.json()
    assert payload["code"] == 500
    assert payload["result"] is None
