from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from server import create_app, storage


@pytest.fixture
def app(tmp_path):
    db_path = tmp_path / "test.db"
    application = create_app(
        {
            "TESTING": True,
            "DATABASE_URL": f"sqlite:///{db_path}",
            "ENVIRONMENT": "test",
            "HF_TOKEN": None,
        }
    )
    with application.app_context():
        now = datetime.now(timezone.utc)
        readings = [
            {
                "timestamp": (now - timedelta(minutes=10)).isoformat(),
                "temperature": 28.0,
                "humidity": 70.0,
                "tds": 900,
                "ph": 6.1,
            },
            {
                "timestamp": (now - timedelta(minutes=40)).isoformat(),
                "temperature": 30.0,
                "humidity": 75.0,
                "tds": 1100,
                "ph": 6.3,
            },
            {
                "timestamp": (now - timedelta(hours=5)).isoformat(),
                "temperature": 26.0,
                "humidity": 60.0,
                "tds": 800,
                "ph": 6.7,
            },
        ]
        for reading in readings:
            storage.insert_reading(reading)
    yield application


@pytest.fixture
def client(app):
    return app.test_client()


def test_hour_summary_filters_recent(client):
    response = client.get("/api/summary/hour")
    data = response.get_json()
    assert data["count"] == 2
    assert data["stats"]["temperature"]["max"] == 30.0
    assert round(data["stats"]["humidity"]["avg"], 1) == 72.5


def test_day_summary_includes_all(client):
    response = client.get("/api/summary/day")
    data = response.get_json()
    assert data["count"] == 3
    assert data["stats"]["tds"]["min"] == 800
    assert data["stats"]["ph"]["max"] == 6.7
