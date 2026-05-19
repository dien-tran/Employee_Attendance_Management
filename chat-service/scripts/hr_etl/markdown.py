from __future__ import annotations

from pathlib import Path
from typing import Any

from .metrics import _escape_md_cell

def to_markdown(payload: dict[str, Any]) -> str:
    topic = payload.get("topic", "all")
    title_map = {
        "staff": "# HR Staff Summary",
        "attendance": "# HR Attendance Summary",
        "all": "# HR Scenario Summary (Single Table)",
    }
    lines: list[str] = []
    lines.append(title_map.get(topic, "# HR Scenario Summary"))
    lines.append("")
    lines.append(f"- scenario: `{payload['scenario_slug']}`")
    lines.append(f"- generated_at: {payload['generated_at']}")
    lines.append(f"- as_of_date: {payload['as_of_date']}")
    lines.append(f"- window_this_month: {payload['windows']['this_month']}")
    lines.append(f"- window_previous_month: {payload['windows']['previous_month']}")
    lines.append(f"- window_yesterday: {payload['windows']['yesterday']}")
    lines.append(f"- window_last_12_months: {payload['windows']['last_12_months']}")
    lines.append("")

    lines.append("| level | group | question | answer | details |")
    lines.append("| --- | --- | --- | --- | --- |")
    for row in payload["qa_rows"]:
        lines.append(
            "| "
            + " | ".join(
                [
                    _escape_md_cell(row.get("level", "")),
                    _escape_md_cell(row.get("group", "")),
                    _escape_md_cell(row.get("question", "")),
                    _escape_md_cell(row.get("answer", "")),
                    _escape_md_cell(row.get("details", "")),
                ]
            )
            + " |"
        )

    lines.append("")
    lines.append("## Notes")
    for note in payload["notes"]:
        lines.append(f"- {note}")
    lines.append("")
    return "\n".join(lines)


def filter_payload_by_topic(payload: dict[str, Any], topic: str) -> dict[str, Any]:
    if topic not in {"staff", "attendance"}:
        raise ValueError(f"Unsupported topic: {topic}")
    qa_rows = [row for row in payload["qa_rows"] if row.get("topic") == topic]
    return {
        "scenario_slug": f"{payload['scenario_slug']}_{topic}",
        "generated_at": payload["generated_at"],
        "as_of_date": payload["as_of_date"],
        "windows": payload["windows"],
        "notes": payload["notes"],
        "qa_rows": qa_rows,
        "topic": topic,
    }


def publish_markdown(payload: dict[str, Any], output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(to_markdown(payload), encoding="utf-8")
    return output_path


