import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from . import storage
from .ai import ai_chat


def create_app(config: Optional[Dict[str, str]] = None) -> Flask:
    load_dotenv()

    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY", "change-this-key"),
        ENVIRONMENT=os.getenv("ENVIRONMENT", "development"),
        DATABASE_URL=os.getenv("DATABASE_URL", "sqlite:///ihydro.db"),
        HF_TOKEN=os.getenv("HF_TOKEN"),
        HF_MODEL=os.getenv("HF_MODEL", "openai/gpt-oss-20b:groq"),
        SENSOR_INTERVAL=int(os.getenv("SENSOR_INTERVAL_SECONDS", "10")),
        MAX_CHAT_HISTORY=int(os.getenv("MAX_CHAT_HISTORY", "10")),
        MAX_CHAT_MESSAGE_LENGTH=int(os.getenv("MAX_CHAT_MESSAGE_LENGTH", "500")),
        ALLOWED_ORIGINS=os.getenv("ALLOWED_ORIGINS", ""),
    )
    if config:
        app.config.update(config)

    storage.init_app(app)

    if not app.testing:
        with app.app_context():
            if not storage.latest_sensor():
                storage.insert_random_reading()

    limiter = Limiter(get_remote_address, app=app, default_limits=["120 per hour"])

    _configure_cors(app)

    @app.before_request
    def ensure_session_id() -> None:
        if "chat_session_id" not in session:
            session["chat_session_id"] = uuid.uuid4().hex

    @app.get("/api/sensors")
    def get_sensors():
        reading = storage.latest_sensor()
        if not reading:
            return jsonify({}), 404
        return jsonify(reading)

    @app.get("/api/history")
    def get_history():
        try:
            limit = int(request.args.get("limit", "50"))
        except ValueError:
            return jsonify({"error": "limit must be an integer"}), 400
        limit = max(1, min(limit, 500))
        history = storage.sensor_history(limit)
        return jsonify(history)

    @app.get("/api/summary/<range_name>")
    def get_summary(range_name: str):
        window = _resolve_window(range_name, request.args)
        if not window:
            return jsonify({"error": "invalid range"}), 400

        since = datetime.now(timezone.utc) - window
        stats = storage.summary_since(since)
        return jsonify({
            "range": range_name,
            "count": stats["count"],
            "stats": stats["metrics"],
        })

    @app.post("/api/chat")
    @limiter.limit("5 per minute")
    def chat():
        payload = request.get_json(silent=True) or {}
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            return jsonify({"error": "message is required"}), 400
        if len(message) > app.config["MAX_CHAT_MESSAGE_LENGTH"]:
            return (
                jsonify({"error": "message too long"}),
                400,
            )

        session_id = session["chat_session_id"]
        storage.append_chat_message(session_id, "user", message)

        history = storage.chat_history(session_id, app.config["MAX_CHAT_HISTORY"])
        reply = ai_chat(app.config["HF_MODEL"], history, message, app.config.get("HF_TOKEN"))
        storage.append_chat_message(session_id, "assistant", reply)

        return jsonify({"response": reply})

    if not app.testing:
        _start_sensor_thread(app)

    return app


def _resolve_window(range_name: str, args) -> Optional[timedelta]:
    try:
        if range_name == "hour":
            minutes = int(args.get("minutes", 60))
            return timedelta(minutes=max(1, min(minutes, 720)))
        if range_name == "day":
            hours = int(args.get("hours", 24))
            return timedelta(hours=max(1, min(hours, 168)))
        if range_name == "custom":
            seconds = int(args.get("seconds", 0))
            if seconds <= 0:
                return None
            return timedelta(seconds=seconds)
    except (TypeError, ValueError):
        return None
    return None


def _configure_cors(app: Flask) -> None:
    origins_env = app.config["ALLOWED_ORIGINS"].strip()
    origins: List[str]
    if app.config["ENVIRONMENT"] == "production" and origins_env:
        origins = [o.strip() for o in origins_env.split(",") if o.strip()]
        CORS(app, origins=origins, supports_credentials=True)
    else:
        CORS(app, supports_credentials=True)


def _start_sensor_thread(app: Flask) -> None:
    interval = app.config["SENSOR_INTERVAL"]

    def auto_update() -> None:
        with app.app_context():
            while True:
                storage.insert_random_reading()
                time.sleep(interval)

    thread = threading.Thread(target=auto_update, daemon=True)
    thread.start()


__all__ = ["create_app"]
