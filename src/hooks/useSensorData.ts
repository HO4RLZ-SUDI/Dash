import { useEffect, useState } from "react";
import type { Sensor, SummaryStat } from "../types";

export function useSensorData() {
  const [current, setCurrent] = useState<Sensor | null>(null);
  const [history, setHistory] = useState<Sensor[]>([]);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const evtSource = new EventSource("http://192.168.189.155:5000/api/stream");
    setOnline(true);

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setCurrent(data);
      setHistory((prev) => [...prev.slice(-49), data]); // เก็บแค่ 50 จุดหลังสุด
    };

    evtSource.onerror = () => setOnline(false);
    return () => evtSource.close();
  }, []);

  // ✅ สร้างค่าหลอก SummaryStat ให้ครบ min/max/avg
  const emptyStat: SummaryStat = { min: 0, max: 0, avg: 0 };

  const summaries = {
    hour: {
      stats: {
        temperature: emptyStat,
        humidity: emptyStat,
        tds: emptyStat,
        ph: emptyStat,
      },
    },
    day: {
      stats: {
        temperature: emptyStat,
        humidity: emptyStat,
        tds: emptyStat,
        ph: emptyStat,
      },
    },
  };

  return { current, history, summaries, online };
}
