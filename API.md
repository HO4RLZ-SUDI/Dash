# API Reference

Base URL defaults to `http://localhost:5000` unless `VITE_API_BASE` overrides it.

## Sensor endpoints

### `GET /api/sensors`
Returns the latest sensor reading.

```json
{
  "timestamp": "2025-01-01T12:34:56.000000+00:00",
  "temperature": 28.4,
  "humidity": 71.2,
  "tds": 950,
  "ph": 6.2
}
```

### `GET /api/history?limit=50`
Returns up to `limit` recent readings in chronological order (oldest first). `limit` is capped at 500.

### `GET /api/summary/{range}`
- `range`: `hour`, `day`, or `custom`.
- Optional query parameters:
  - `minutes` (for `hour`) default `60`, max `720`.
  - `hours` (for `day`) default `24`, max `168`.
  - `seconds` (for `custom`) required positive integer.

Example response:

```json
{
  "range": "hour",
  "count": 12,
  "stats": {
    "temperature": { "min": 25.1, "avg": 28.6, "max": 31.4 },
    "humidity": { "min": 62.0, "avg": 70.3, "max": 79.1 },
    "tds": { "min": 820, "avg": 943.3, "max": 1105 },
    "ph": { "min": 5.9, "avg": 6.3, "max": 6.6 }
  }
}
```

If no readings are available in the window, `count` is `0` and the statistics values are `null`.

## Chat endpoint

### `POST /api/chat`
Body: `{ "message": "string" }`

Validation:
- Rejects empty or non-string input.
- Enforces `MAX_CHAT_MESSAGE_LENGTH` characters.
- Rate-limited to 5 requests per minute per client IP.

Response (per session history is persisted server-side):

```json
{ "response": "string" }
```

## TypeScript contracts

The frontend consumes responses via the types in `src/types.ts`:

```ts
export interface Sensor {
  timestamp: string;
  temperature: number;
  humidity: number;
  tds: number;
  ph: number;
}

export interface SummaryStat {
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface SummaryResponse {
  range: "hour" | "day" | "custom" | string;
  count: number;
  stats: {
    temperature: SummaryStat;
    humidity: SummaryStat;
    tds: SummaryStat;
    ph: SummaryStat;
  };
}

export interface ChatResponse {
  response: string;
}
```

Runtime validation lives in `src/api.ts`, leveraging the lightweight `z` helper to enforce the schema before data enters the UI.
