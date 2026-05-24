from __future__ import annotations

import argparse
from datetime import date, time
from pathlib import Path

from .config import (
    DEFAULT_ATTENDANCE_SUMMARY_PATH,
    DEFAULT_STAFF_SUMMARY_PATH,
    UnifiedHRConfig,
)
from .extract import extract_frames
from .markdown import filter_payload_by_topic, publish_markdown
from .transform import transform


def run(config: UnifiedHRConfig) -> Path:
    frames = extract_frames()
    payload = transform(frames, config)
    payload["topic"] = "all"
    return publish_markdown(payload, config.output_path)


def run_split(config: UnifiedHRConfig, mode: str = "both") -> dict[str, Path]:
    if mode not in {"both", "staff", "attendance"}:
        raise ValueError(f"Unsupported mode: {mode}")

    frames = extract_frames()
    payload = transform(frames, config)
    outputs: dict[str, Path] = {}

    if mode in {"both", "staff"}:
        staff_payload = filter_payload_by_topic(payload, "staff")
        outputs["staff"] = publish_markdown(staff_payload, config.staff_output_path)

    if mode in {"both", "attendance"}:
        attendance_payload = filter_payload_by_topic(payload, "attendance")
        outputs["attendance"] = publish_markdown(attendance_payload, config.attendance_output_path)

    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Unified HR ETL: generate split markdown summaries for staff/attendance."
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_ATTENDANCE_SUMMARY_PATH,
        help="Output markdown path for legacy single-file mode",
    )
    parser.add_argument(
        "--staff-output",
        default=DEFAULT_STAFF_SUMMARY_PATH,
        help="Output markdown path for staff summary",
    )
    parser.add_argument(
        "--attendance-output",
        default=DEFAULT_ATTENDANCE_SUMMARY_PATH,
        help="Output markdown path for attendance summary",
    )
    parser.add_argument(
        "--mode",
        choices=["both", "staff", "attendance", "single"],
        default="both",
        help="Export both split files, only staff, only attendance, or legacy single file",
    )
    parser.add_argument(
        "--as-of-date",
        default=None,
        help="As-of date (YYYY-MM-DD). Defaults to today.",
    )
    parser.add_argument(
        "--late-threshold",
        default="08:30",
        help="Late checkin threshold in HH:MM, default 08:30",
    )
    parser.add_argument(
        "--exclude-saturday",
        action="store_true",
        help="Exclude Saturday from weekday comparison.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    as_of = date.fromisoformat(args.as_of_date) if args.as_of_date else None
    hour, minute = args.late_threshold.split(":")
    threshold = time(int(hour), int(minute))
    cfg = UnifiedHRConfig(
        output_path=Path(args.output),
        staff_output_path=Path(args.staff_output),
        attendance_output_path=Path(args.attendance_output),
        as_of_date=as_of,
        checkin_late_threshold=threshold,
        include_saturday=not args.exclude_saturday,
    )
    if args.mode == "single":
        out = run(cfg)
        print(f"Markdown exported (single): {out}")
    else:
        outputs = run_split(cfg, mode=args.mode)
        for topic, out_path in outputs.items():
            print(f"Markdown exported ({topic}): {out_path}")


if __name__ == "__main__":
    main()
