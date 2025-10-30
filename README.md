# iHydro Dashboard

A hydroponics monitoring dashboard consisting of a Vite + React frontend and a Flask backend that simulates sensor data, renders live insights, and offers an AI assistant chat.

## Architecture overview
- **Frontend** (`src/`): React + TypeScript single-page app styled with Tailwind. Polls the backend via a reusable `useSensorData` hook, validates responses with a bundled Zod-compatible helper (`src/lib/zod.ts`), and renders metrics/components under `src/components/`.
- **Backend** (`server/`): Flask application with SQLite persistence for sensors/chat and optional Hugging Face powered AI responses. Background task seeds simulated sensor readings during development.
- **Tests** (`tests/`): Pytest suite validating the summary window logic.

## Prerequisites
- Node.js 20+
- Python 3.11+

## Environment variables
Populate the sample files before running the stack:

| Location | Variable | Description |
| --- | --- | --- |
| `.env.example` | `VITE_API_BASE` | Base URL for API requests from the SPA (defaults to `http://localhost:5000`). |
| `server/.env.example` | `FLASK_SECRET_KEY` | Secret key for signing session cookies. **Change in production.** |
|  | `ENVIRONMENT` | `development` or `production` to toggle debug/CORS defaults. |
|  | `DATABASE_URL` | SQLite DSN (e.g. `sqlite:///ihydro.db`). |
|  | `SENSOR_INTERVAL_SECONDS` | Background sensor generation cadence. |
|  | `MAX_CHAT_HISTORY` | Messages persisted per session in chat history. |
|  | `MAX_CHAT_MESSAGE_LENGTH` | Server-side validation cap for chat input. |
|  | `ALLOWED_ORIGINS` | Comma-separated whitelist of origins when `ENVIRONMENT=production`. |
|  | `HF_MODEL` | Hugging Face model identifier. |
|  | `HF_TOKEN` | Hugging Face API token (leave empty locally to disable AI replies). |

Copy the files, then edit the values as needed:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

## Local development

```bash
# Frontend
npm install
npm run dev

# Backend
python server/server.py
```

The Vite dev server defaults to `http://localhost:5173`; the Flask API runs on `http://localhost:5000`.

## Production notes
- Set `ENVIRONMENT=production`, provide a strong `FLASK_SECRET_KEY`, and configure `ALLOWED_ORIGINS`.
- Point `DATABASE_URL` at a writable location (persistent volume or managed SQLite-compatible service).
- Omit `SENSOR_INTERVAL_SECONDS` and seed real sensor data ingestion instead of the simulator.
- Provide a valid `HF_TOKEN` or disable chat AI access if external LLM calls are not permitted.

## Testing & verification

```bash
# TypeScript build (type-checks and bundle)
npm run build

# Lint
npm run lint

# Python tests
pip install -r server/requirements-dev.txt
pytest
```

> **Note:** In sandboxed environments without internet access, dependency installation commands may fail. The application code itself does not require outbound access once dependencies are installed.

## Security checklist
- Keep secrets in environment variables only—never commit `.env` files.
- Restrict `ALLOWED_ORIGINS` and run with `ENVIRONMENT=production` outside local dev.
- Rotate the Hugging Face token regularly and scope it to read-only usage.
- Consider externalizing chat/sensor storage to managed services for redundancy and backups.
