import { useEffect, useMemo, useState } from "react";

import { api } from "./api";
import { Alerts } from "./components/Alerts";
import { Sparkline } from "./components/Sparkline";
import { StatCard } from "./components/StatCard";
import { useSensorData } from "./hooks/useSensorData";
import type { Sensor, SummaryStat } from "./types";

type Bubble = { role: "user" | "ai"; text: string };

const fmt = (n?: number | null, digits = 1) => (typeof n === "number" ? n.toFixed(digits) : "-");
const fmtInt = (n?: number | null) => (typeof n === "number" ? Math.round(n).toString() : "-");

const okRange = (s?: Sensor | null) => {
  if (!s) return { temp: false, hum: false, tds: false, ph: false };
  return {
    temp: s.temperature >= 25 && s.temperature <= 32,
    hum: s.humidity >= 65 && s.humidity <= 80,
    tds: s.tds >= 900 && s.tds <= 1200,
    ph: s.ph >= 5.8 && s.ph <= 6.8,
  };
};

const mark = (ok: boolean) => (ok ? "✅" : "⚠️");

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem("dark") === "true");
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("dark", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const { current: cur, history: hist, summaries, online } = useSensorData();
  const sumHour = summaries.hour;
  const sumDay = summaries.day;

  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<Bubble[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  const series = useMemo(
    () => ({
      temperature: hist.map((d) => d.temperature),
      humidity: hist.map((d) => d.humidity),
      tds: hist.map((d) => d.tds),
      ph: hist.map((d) => d.ph),
    }),
    [hist],
  );

  const rangeOK = useMemo(() => okRange(cur), [cur]);

  const alerts = useMemo(() => {
    if (!cur) return [] as string[];
    const arr: string[] = [];
    if (!rangeOK.temp) arr.push(`อุณหภูมิ ${cur.temperature}°C นอกช่วงแนะนำ (25–32°C)`);
    if (!rangeOK.hum) arr.push(`ความชื้น ${cur.humidity}% นอกช่วงแนะนำ (65–80%)`);
    if (!rangeOK.tds) arr.push(`TDS ${cur.tds} ppm นอกช่วงแนะนำ (900–1200 ppm)`);
    if (!rangeOK.ph) arr.push(`pH ${cur.ph} นอกช่วงแนะนำ (5.8–6.8)`);
    return arr;
  }, [cur, rangeOK]);

  const send = async () => {
    const q = msg.trim();
    if (!q) return;
    const nextChat: Bubble[] = [...chat, { role: "user", text: q }];
    setChat(nextChat);
    setMsg("");
    setLoadingAI(true);
    try {
      const res = await api.chat(q);
      setChat((c) => [...c, { role: "ai", text: res.response }]);
    } catch {
      setChat((c) => [...c, { role: "ai", text: "AI ไม่พร้อม ลองใหม่อีกทีนะ 🤖" }]);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
      <header className={`sticky top-0 z-40 border-b ${dark ? "bg-slate-800/80" : "bg-white/80"} backdrop-blur`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 grid place-items-center text-white font-black">iH</div>
            <div className="font-semibold">iHydro Dashboard</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span className="opacity-70">{online ? "Online" : "Offline"}</span>
            <button
              onClick={toggleDark}
              className="ml-3 px-3 py-1 text-xs border rounded-full hover:bg-emerald-100 dark:hover:bg-slate-700"
            >
              {dark ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="🌡️ อุณหภูมิ (°C)" value={fmt(cur?.temperature)} ok={rangeOK.temp} />
            <StatCard label="💧 ความชื้น (%)" value={fmt(cur?.humidity)} ok={rangeOK.hum} />
            <StatCard label="⚗️ TDS (ppm)" value={fmtInt(cur?.tds)} ok={rangeOK.tds} />
            <StatCard label="🧪 pH" value={fmt(cur?.ph)} ok={rangeOK.ph} />
          </div>

          <Alerts items={alerts} />

          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="อุณหภูมิ (°C)">
              <Sparkline data={series.temperature} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.temperature} unit="°C" />
              <StatRow label="วันนี้" stats={sumDay?.stats.temperature} unit="°C" />
            </Panel>
            <Panel title="ความชื้น (%)">
              <Sparkline data={series.humidity} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.humidity} unit="%" />
              <StatRow label="วันนี้" stats={sumDay?.stats.humidity} unit="%" />
            </Panel>
            <Panel title="TDS (ppm)">
              <Sparkline data={series.tds} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.tds} unit=" ppm" intOnly />
              <StatRow label="วันนี้" stats={sumDay?.stats.tds} unit=" ppm" intOnly />
            </Panel>
            <Panel title="pH">
              <Sparkline data={series.ph} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.ph} />
              <StatRow label="วันนี้" stats={sumDay?.stats.ph} />
            </Panel>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border rounded-2xl p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="font-semibold mb-2">🤖 ผู้ช่วย iHydro AI</div>
            <div className="h-72 overflow-y-auto space-y-2 pr-1">
              {chat.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`px-3 py-2 rounded-2xl max-w-[85%] ${
                    m.role === "user"
                      ? "ml-auto bg-emerald-100 border border-emerald-300 dark:bg-emerald-700/50"
                      : "bg-slate-100 border dark:bg-slate-700/60"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {loadingAI && <div className="text-sm opacity-60">กำลังพิมพ์…</div>}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-slate-700 dark:border-slate-600"
                placeholder="พิมพ์เช่น: แนะนำการปรับ pH..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button onClick={send} className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600">
                ส่ง
              </button>
            </div>
          </div>

          <div className="border rounded-2xl p-4 bg-emerald-50/60 dark:bg-emerald-900/30">
            <div className="font-semibold mb-1">ภาพรวมเร็ว 🌿</div>
            <ul className="text-sm space-y-1">
              <li>อุณหภูมิ: {fmt(cur?.temperature)} °C {mark(rangeOK.temp)}</li>
              <li>ความชื้น: {fmt(cur?.humidity)} % {mark(rangeOK.hum)}</li>
              <li>TDS: {fmtInt(cur?.tds)} ppm {mark(rangeOK.tds)}</li>
              <li>pH: {fmt(cur?.ph)} {mark(rangeOK.ph)}</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-2xl p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="text-sm font-medium mb-2">{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, stats, unit = "", intOnly = false }: { label: string; stats?: SummaryStat | null; unit?: string; intOnly?: boolean }) {
  const show = (n?: number | null) => (intOnly ? fmtInt(n) : fmt(n));
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-[13px] text-slate-700 dark:text-slate-300">
      <div className="col-span-3 font-medium">{label}</div>
      <div className="rounded-lg border px-2 py-1 bg-white dark:bg-slate-700">ต่ำสุด: {show(stats?.min)}{unit}</div>
      <div className="rounded-lg border px-2 py-1 bg-white dark:bg-slate-700">เฉลี่ย: {show(stats?.avg)}{unit}</div>
      <div className="rounded-lg border px-2 py-1 bg-white dark:bg-slate-700">สูงสุด: {show(stats?.max)}{unit}</div>
    </div>
  );
}
