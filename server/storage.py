import os
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from flask import Flask, current_app, g


def init_app(app: Flask) -> None:
    database_url = app.config["DATABASE_URL"]
    path, uri = _resolve_database_path(database_url)
    app.config["DATABASE_PATH"] = path
    app.config["DATABASE_URI"] = uri

    Path(path if not uri else _path_from_uri(path)).parent.mkdir(parents=True, exist_ok=True)

    with _connect(app) as conn:
        # ✅ เพิ่มคอลัมน์ water_temp เข้าไปในตาราง sensor_readings
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                tds REAL NOT NULL,
                ph REAL NOT NULL,
                water_temp REAL DEFAULT 0.0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()

    app.teardown_appcontext(close_connection)


@contextmanager
def _connect(app: Flask):
    conn = sqlite3.connect(
        app.config["DATABASE_PATH"],
        detect_types=sqlite3.PARSE_DECLTYPES,
        check_same_thread=False,
        uri=app.config["DATABASE_URI"],
    )
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _connection(app: Flask) -> sqlite3.Connection:
    if "_db_conn" not in g:
        g._db_conn = sqlite3.connect(
            app.config["DATABASE_PATH"],
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
            uri=app.config["DATABASE_URI"],
        )
        g._db_conn.row_factory = sqlite3.Row
    return g._db_conn


# ===============================================================
# 🔹 อ่านค่าล่าสุด
# ===============================================================
def latest_sensor() -> Optional[Dict]:
    app = current_app
    conn = _connection(app)
    row = conn.execute(
        "SELECT timestamp, temperature, humidity, tds, ph, water_temp FROM sensor_readings ORDER BY timestamp DESC LIMIT 1"
    ).fetchone()
    return dict(row) if row else None


# ===============================================================
# 🔹 ประวัติย้อนหลัง
# ===============================================================
def sensor_history(limit: int) -> List[Dict]:
    app = current_app
    conn = _connection(app)
    rows = conn.execute(
        "SELECT timestamp, temperature, humidity, tds, ph, water_temp FROM sensor_readings ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(row) for row in reversed(rows)]


# ===============================================================
# 🔹 สรุปค่าตามช่วงเวลา
# ===============================================================
def summary_since(since: datetime) -> Dict:
    app = current_app
    conn = _connection(app)
    row = conn.execute(
        """
        SELECT
            COUNT(*) as count,
            MIN(temperature) as min_temp,
            MAX(temperature) as max_temp,
            AVG(temperature) as avg_temp,
            MIN(humidity) as min_humidity,
            MAX(humidity) as max_humidity,
            AVG(humidity) as avg_humidity,
            MIN(tds) as min_tds,
            MAX(tds) as max_tds,
            AVG(tds) as avg_tds,
            MIN(ph) as min_ph,
            MAX(ph) as max_ph,
            AVG(ph) as avg_ph,
            MIN(water_temp) as min_water,
            MAX(water_temp) as max_water,
            AVG(water_temp) as avg_water
        FROM sensor_readings
        WHERE timestamp >= ?
        """,
        (since.isoformat(),),
    ).fetchone()

    metrics = {
        "temperature": _pack_stat(row["min_temp"], row["max_temp"], row["avg_temp"]),
        "humidity": _pack_stat(row["min_humidity"], row["max_humidity"], row["avg_humidity"]),
        "tds": _pack_stat(row["min_tds"], row["max_tds"], row["avg_tds"]),
        "ph": _pack_stat(row["min_ph"], row["max_ph"], row["avg_ph"]),
        "water_temp": _pack_stat(row["min_water"], row["max_water"], row["avg_water"]),
    }
    return {"count": row["count"], "metrics": metrics}


# ===============================================================
# 🔹 สุ่มค่าเซ็นเซอร์จำลอง (ใช้ตอน debug)
# ===============================================================
def insert_random_reading() -> None:
    app = current_app
    reading = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "temperature": round(random.uniform(25, 35), 1),
        "humidity": round(random.uniform(50, 90), 1),
        "tds": round(random.uniform(700, 1300), 0),
        "ph": round(random.uniform(5.5, 7.5), 2),
        "water_temp": round(random.uniform(22, 30), 1),
    }
    insert_reading(reading)


# ===============================================================
# 🔹 เพิ่มข้อมูลจริงจาก Arduino UNO R4 WiFi
# ===============================================================
def insert_sensor_reading(data: Dict[str, float]) -> None:
    app = current_app
    conn = _connection(app)
    conn.execute(
        """
        INSERT INTO sensor_readings (timestamp, temperature, humidity, tds, ph, water_temp)
        VALUES (:timestamp, :temperature, :humidity, :tds, :ph, :water_temp)
        """,
        data,
    )
    conn.commit()


# ===============================================================
# 🔹 ใช้สำหรับข้อมูลที่สร้างภายในแอป (แบบ random)
# ===============================================================
def insert_reading(reading: Dict[str, float]) -> None:
    app = current_app
    conn = _connection(app)
    conn.execute(
        """
        INSERT INTO sensor_readings (timestamp, temperature, humidity, tds, ph, water_temp)
        VALUES (:timestamp, :temperature, :humidity, :tds, :ph, :water_temp)
        """,
        reading,
    )
    conn.commit()


# ===============================================================
# 🔹 แชทบอทเก็บข้อความ
# ===============================================================
def append_chat_message(session_id: str, role: str, content: str) -> None:
    app = current_app
    conn = _connection(app)
    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, role, content, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def chat_history(session_id: str, limit: int) -> List[Dict]:
    app = current_app
    conn = _connection(app)
    rows = conn.execute(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    ).fetchall()
    return [dict(row) for row in reversed(rows)]


def close_connection(exception=None):
    conn = g.pop("_db_conn", None)
    if conn is not None:
        conn.close()


# ===============================================================
# 🔹 Utils
# ===============================================================
def _resolve_database_path(database_url: str) -> Tuple[str, bool]:
    if database_url.startswith("sqlite:///"):
        path = database_url.replace("sqlite:///", "", 1)
        uri = False
    elif database_url.startswith("file:"):
        path = database_url
        uri = True
    else:
        raise ValueError("Only sqlite paths are supported")

    if path == ":memory:":
        uri = True
        path = "file:ihydro?mode=memory&cache=shared"
    if not uri:
        path = os.path.abspath(path)
    return path, uri


def _path_from_uri(uri: str) -> str:
    if uri.startswith("file:"):
        return uri.split("?", 1)[0][5:]
    return uri


def _pack_stat(min_val, max_val, avg_val):
    return {"min": min_val, "max": max_val, "avg": avg_val}
