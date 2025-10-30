import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import type { Sensor, SummaryResponse } from "../types";

export interface UseSensorDataOptions {
  intervalSeconds?: number;
  historyLimit?: number;
}

interface SensorDataResult {
  current: Sensor | null;
  history: Sensor[];
  summaries: {
    hour: SummaryResponse | null;
    day: SummaryResponse | null;
  };
  online: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSensorData(options: UseSensorDataOptions = {}): SensorDataResult {
  const intervalMs = useMemo(
    () => Math.max(1000, (options.intervalSeconds ?? 10) * 1000),
    [options.intervalSeconds],
  );
  const historyLimit = options.historyLimit ?? 60;

  const [current, setCurrent] = useState<Sensor | null>(null);
  const [history, setHistory] = useState<Sensor[]>([]);
  const [summaries, setSummaries] = useState<{ hour: SummaryResponse | null; day: SummaryResponse | null }>(
    () => ({ hour: null, day: null }),
  );
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sensor, readings, hourSummary, daySummary] = await Promise.all([
      api.sensors(),
      api.history(historyLimit),
      api.summary("hour"),
      api.summary("day"),
    ]);
    setCurrent(sensor);
    setHistory(readings);
    setSummaries({ hour: hourSummary, day: daySummary });
    setOnline(true);
  }, [historyLimit]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setOnline(false);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    let active = true;
    let timer: number;
    let firstLoad = true;

    const tick = async () => {
      try {
        await load();
      } catch {
        if (!active) return;
        setOnline(false);
      } finally {
        if (firstLoad) {
          firstLoad = false;
          setLoading(false);
        }
      }
      if (!active) {
        return;
      }
      timer = window.setTimeout(tick, intervalMs);
    };

    tick();

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [intervalMs, load]);

  return { current, history, summaries, online, loading, refresh };
}
