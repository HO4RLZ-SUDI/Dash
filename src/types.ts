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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
