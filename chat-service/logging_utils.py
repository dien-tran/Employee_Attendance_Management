from __future__ import annotations

import logging
import os
import sys
from datetime import datetime

RESET = "\033[0m"
DIM = "\033[2m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"


class FancyTerminalFormatter(logging.Formatter):
    def __init__(self, use_color: bool, name_width: int = 28) -> None:
        super().__init__()
        self.use_color = use_color
        self.name_width = max(12, name_width)

    def _colorize(self, text: str, color: str, bold: bool = False, dim: bool = False) -> str:
        if not self.use_color:
            return text
        styles = []
        if dim:
            styles.append(DIM)
        if bold:
            styles.append(BOLD)
        styles.append(color)
        return "".join(styles) + text + RESET

    def _level_color(self, levelno: int) -> str:
        if levelno >= logging.CRITICAL:
            return MAGENTA
        if levelno >= logging.ERROR:
            return RED
        if levelno >= logging.WARNING:
            return YELLOW
        if levelno >= logging.INFO:
            return GREEN
        return CYAN

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        level = f"{record.levelname:<8}"
        logger_name = f"{record.name:<{self.name_width}}"
        message = record.getMessage()

        ts_out = self._colorize(timestamp, CYAN, dim=True)
        lv_out = self._colorize(level, self._level_color(record.levelno), bold=True)
        lg_out = self._colorize(logger_name, CYAN)

        line = f"{ts_out} | {lv_out} | {lg_out} | {message}"

        if record.exc_info:
            exc_text = self.formatException(record.exc_info)
            line = f"{line}\n{exc_text}"
        return line


def _use_color(stdout: object) -> bool:
    color_mode = os.getenv("HR_CHATBOT_LOG_COLOR", "auto").strip().lower()
    if os.getenv("NO_COLOR"):
        return False
    if color_mode in {"off", "0", "false", "no"}:
        return False
    if color_mode in {"on", "1", "true", "yes"}:
        return True
    isatty = getattr(stdout, "isatty", lambda: False)
    return bool(isatty())


def _build_formatter() -> FancyTerminalFormatter:
    try:
        name_width = int(os.getenv("HR_CHATBOT_LOG_NAME_WIDTH", "28"))
    except ValueError:
        name_width = 28
    return FancyTerminalFormatter(use_color=_use_color(sys.stdout), name_width=name_width)


def _apply_formatter_to_handlers(
    handlers: list[logging.Handler], formatter: logging.Formatter
) -> None:
    for handler in handlers:
        if isinstance(handler, logging.StreamHandler):
            handler.setFormatter(formatter)


def configure_logging() -> None:
    level_name = os.getenv("HR_CHATBOT_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    formatter = _build_formatter()

    root = logging.getLogger()
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler(stream=sys.stdout)
        handler.setLevel(level)
        handler.setFormatter(formatter)
        root.addHandler(handler)
    else:
        _apply_formatter_to_handlers(root.handlers, formatter)
        for handler in root.handlers:
            handler.setLevel(level)

    # Make uvicorn logs use the same terminal formatter for consistent view.
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.setLevel(level)
        _apply_formatter_to_handlers(uvicorn_logger.handlers, formatter)
