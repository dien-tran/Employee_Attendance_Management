import os
from typing import Any

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import Error

load_dotenv()


def _read_config(
    *,
    host_env: str,
    port_env: str,
    user_env: str,
    password_env: str,
    name_env: str,
    default_host: str,
    default_port: str,
    default_user: str,
    default_password: str,
    default_name: str,
) -> dict[str, Any]:
    return {
        "host": os.getenv(host_env, default_host),
        "user": os.getenv(user_env, default_user),
        "password": os.getenv(password_env, default_password),
        "database": os.getenv(name_env, default_name),
        "port": int(os.getenv(port_env, default_port)),
    }


AUTH_DB_CONFIG = _read_config(
    host_env="AUTH_DB_HOST",
    port_env="AUTH_DB_PORT",
    user_env="AUTH_DB_USER",
    password_env="AUTH_DB_PASSWORD",
    name_env="AUTH_DB_NAME",
    default_host="localhost",
    default_port="3306",
    default_user="auth_user",
    default_password="",
    default_name="auth_db",
)

CORE_DB_CONFIG = _read_config(
    host_env="CORE_DB_HOST",
    port_env="CORE_DB_PORT",
    user_env="CORE_DB_USER",
    password_env="CORE_DB_PASSWORD",
    name_env="CORE_DB_NAME",
    default_host="localhost",
    default_port="3306",
    default_user="core_user",
    default_password="",
    default_name="core_db",
)


def _get_connection(config: dict[str, Any]):
    try:
        conn = mysql.connector.connect(**config)
        if conn.is_connected():
            return conn
    except Error as exc:
        print(f"Error connecting to MySQL: {exc}")
    return None


def _run_select_with_config(
    config: dict[str, Any],
    sql: str,
    params: tuple[Any, ...] | None = None,
) -> dict[str, Any]:
    conn = _get_connection(config)
    if not conn:
        raise RuntimeError("Unable to connect to database.")

    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params or ())
        rows = cursor.fetchall()
        columns = list(rows[0].keys()) if rows else [col[0] for col in (cursor.description or [])]
        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
        }
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        conn.close()


def run_auth_select(sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any]:
    return _run_select_with_config(AUTH_DB_CONFIG, sql, params)


def run_core_select(sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any]:
    return _run_select_with_config(CORE_DB_CONFIG, sql, params)


def run_select(sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any]:
    # Backward-compatible alias for legacy scripts.
    return run_auth_select(sql, params)
