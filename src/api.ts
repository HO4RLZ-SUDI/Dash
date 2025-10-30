import { z, type ZodSchema } from "./lib/zod";

import type { ChatResponse, Sensor, SummaryResponse } from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const numberField = z.coerce.number();

const sensorSchema = z.object({
  timestamp: z.string(),
  temperature: numberField,
  humidity: numberField,
  tds: numberField,
  ph: numberField,
});

const summaryStatSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  avg: z.number().nullable(),
});

const summarySchema = z.object({
  range: z.string(),
  count: z.number(),
  stats: z.object({
    temperature: summaryStatSchema,
    humidity: summaryStatSchema,
    tds: summaryStatSchema,
    ph: summaryStatSchema,
  }),
});

const chatResponseSchema = z.object({ response: z.string() });

async function parseJson<T>(res: Response, schema: ZodSchema<T>): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const data = await res.json();
  return schema.parse(data);
}

function withQuery(path: string, params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        query.set(key, String(value));
      }
    }
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const api = {
  sensors: async (): Promise<Sensor> => {
    const res = await fetch(`${API_BASE}/api/sensors`);
    return parseJson(res, sensorSchema) as Promise<Sensor>;
  },

  history: async (limit?: number): Promise<Sensor[]> => {
    const res = await fetch(`${API_BASE}${withQuery("/api/history", { limit })}`);
    return parseJson(res, z.array(sensorSchema)) as Promise<Sensor[]>;
  },

  summary: async (
    range: "hour" | "day" | "custom",
    params?: Record<string, string | number | undefined>,
  ): Promise<SummaryResponse> => {
    const res = await fetch(`${API_BASE}${withQuery(`/api/summary/${range}`, params)}`);
    return parseJson(res, summarySchema) as Promise<SummaryResponse>;
  },

  chat: async (message: string): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    return parseJson(res, chatResponseSchema) as Promise<ChatResponse>;
  },
};
