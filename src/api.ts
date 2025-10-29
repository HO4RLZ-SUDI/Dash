export type Sensor = {
  timestamp: string;
  temperature: number;
  humidity: number;
  tds: number;
  ph: number;
};

export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5000";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  sensors: () => fetch(`${API_BASE}/api/sensors`).then(j<Sensor>),

  history: () => fetch(`${API_BASE}/api/history`).then(j<Sensor[]>),

  summary: (range: "hour" | "day") =>
    fetch(`${API_BASE}/api/summary/${range}`).then((res) =>
      j<{ range: string; count: number; stats: any }>(res)
    ),

  chat: (msg: string) =>
    fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    }).then(j<{ response: string }>),
};
