// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Sensor } from "./api";

/* =========================
   Helpers & Types
========================= */
type Bubble = { role: "user" | "ai"; text: string };

type RangeSummary = {
  range: "hour" | "day";
  count: number;
  stats: {
    temperature?: { min?: number; max?: number; avg?: number };
    humidity?: { min?: number; max?: number; avg?: number };
    tds?: { min?: number; max?: number; avg?: number };
    ph?: { min?: number; max?: number; avg?: number };
  };
};

const okRange = (s?: Sensor) => {
  if (!s) return { temp: false, hum: false, tds: false, ph: false };
  return {
    temp: s.temperature >= 25 && s.temperature <= 32,
    hum: s.humidity >= 65 && s.humidity <= 80,
    tds: s.tds >= 900 && s.tds <= 1200,
    ph: s.ph >= 5.8 && s.ph <= 6.8,
  };
};

const mark = (ok: boolean) => (ok ? "✅" : "⚠️");
const fmt = (n?: number, d = 1) => (typeof n === "number" ? n.toFixed(d) : "-");
const fmtInt = (n?: number) => (typeof n === "number" ? Math.round(n).toString() : "-");

/* =========================
   Main Component
========================= */
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

  const [cur, setCur] = useState<Sensor | null>(null);
  const [hist, setHist] = useState<Sensor[]>([]);
  const [sumHour, setSumHour] = useState<RangeSummary | null>(null);
  const [sumDay, setSumDay] = useState<RangeSummary | null>(null);
  const [online, setOnline] = useState(true);

  // Chat
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<Bubble[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  // Load sensors
  useEffect(() => {
    let timer: number;
    const load = async () => {
      try {
        const [s, h, sh, sd] = await Promise.all([
          api.sensors(),
          api.history(),
          api.summary("hour"),
          api.summary("day"),
        ]);
        setCur(s);
        setHist(h.slice(-60));
        setSumHour(sh);
        setSumDay(sd);
        setOnline(true);
      } catch {
        setOnline(false);
      } finally {
        timer = window.setTimeout(load, 10_000);
      }
    };
    load();
    return () => clearTimeout(timer);
  }, []);

  const series = useMemo(() => ({
    temperature: hist.map((d) => d.temperature),
    humidity: hist.map((d) => d.humidity),
    tds: hist.map((d) => d.tds),
    ph: hist.map((d) => d.ph),
  }), [hist]);

  const rangeOK = okRange(cur);

  const alerts = useMemo(() => {
    if (!cur) return [] as string[];
    const arr: string[] = [];
    if (!rangeOK.temp) arr.push(`อุณหภูมิ ${cur.temperature}°C นอกช่วงแนะนำ (25–32°C)`);
    if (!rangeOK.hum) arr.push(`ความชื้น ${cur.humidity}% นอกช่วงแนะนำ (65–80%)`);
    if (!rangeOK.tds) arr.push(`TDS ${cur.tds} ppm นอกช่วงแนะนำ (900–1200 ppm)`);
    if (!rangeOK.ph) arr.push(`pH ${cur.ph} นอกช่วงแนะนำ (5.8–6.8)`);
    return arr;
  }, [cur, rangeOK]);

  // Chat send
  const send = async () => {
    const q = msg.trim();
    if (!q) return;
    const newChat = [...chat, { role: "user", text: q }];
    setChat(newChat);
    setMsg("");
    setLoadingAI(true);
    try {
      const r = await api.chat(q);
      setChat((c) => [...c, { role: "ai", text: r.response }]);
    } catch {
      setChat((c) => [...c, { role: "ai", text: "AI ไม่พร้อม ลองใหม่อีกทีนะ 🤖" }]);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors ${dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
      {/* Topbar */}
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <section className="lg:col-span-2 space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="🌡️ อุณหภูมิ (°C)" value={fmt(cur?.temperature)} ok={rangeOK.temp} />
            <MetricCard label="💧 ความชื้น (%)" value={fmt(cur?.humidity)} ok={rangeOK.hum} />
            <MetricCard label="⚗️ TDS (ppm)" value={fmtInt(cur?.tds)} ok={rangeOK.tds} />
            <MetricCard label="🧪 pH" value={fmt(cur?.ph)} ok={rangeOK.ph} />
          </div>

          {/* Alerts */}
          <div className={`rounded-2xl p-4 border ${alerts.length ? "border-amber-300 bg-amber-50/70 dark:bg-yellow-900/30" : "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/30"}`}>
            <div className="font-semibold mb-1">{alerts.length ? "⚠️ ควรตรวจสอบ" : "✅ ปกติทุกค่า"}</div>
            {alerts.length ? (
              <ul className="list-disc pl-5 text-sm space-y-1">
                {alerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm opacity-80">ทุกค่าภายในเกณฑ์แนะนำ เหมาะต่อการเจริญเติบโตของพืช 🌿</div>
            )}
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="อุณหภูมิ (°C)">
              <Sparkline data={series.temperature} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats?.temperature} unit="°C" />
              <StatRow label="วันนี้" stats={sumDay?.stats?.temperature} unit="°C" />
            </Panel>
            <Panel title="ความชื้น (%)">
              <Sparkline data={series.humidity} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats?.humidity} unit="%" />
              <StatRow label="วันนี้" stats={sumDay?.stats?.humidity} unit="%" />
            </Panel>
            <Panel title="TDS (ppm)">
              <Sparkline data={series.tds} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats?.tds} unit=" ppm" intOnly />
              <StatRow label="วันนี้" stats={sumDay?.stats?.tds} unit=" ppm" intOnly />
            </Panel>
            <Panel title="pH">
              <Sparkline data={series.ph} minAuto padding={4} />
              <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats?.ph} />
              <StatRow label="วันนี้" stats={sumDay?.stats?.ph} />
            </Panel>
          </div>
        </section>

        {/* RIGHT */}
        <aside className="space-y-4">
          <div className="border rounded-2xl p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="font-semibold mb-2">🤖 ผู้ช่วย iHydro AI</div>
            <div className="h-72 overflow-y-auto space-y-2 pr-1">
              {chat.map((m, i) => (
                <div
                  key={i}
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

            {/* Chat input */}
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200 dark:bg-slate-700 dark:border-slate-600"
                placeholder="พิมพ์เช่น: แนะนำการปรับ pH..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                onClick={send}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
              >
                ส่ง
              </button>
            </div>
          </div>

          {/* Quick Overview */}
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

/* =========================
   UI Components
========================= */
function MetricCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div
      className={`border rounded-2xl p-4 transition-colors ${
        ok
          ? "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/30"
          : "border-amber-200 bg-amber-50/60 dark:bg-yellow-900/30"
      }`}
    >
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className={`mt-1 text-xs ${ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-yellow-300"}`}>
        {ok ? "ปกติ" : "ควรตรวจสอบ"}
      </div>
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

function Sparkline({ data = [], minAuto = false, padding = 2, width = 400, height = 120 }) {
  if (!data.length) return <div className="h-[120px] grid place-items-center text-sm opacity-60">ไม่มีข้อมูล</div>;
  const min = minAuto ? Math.min(...data) : 0;
  const max = Math.max(...data);
  const span = Math.max(1e-6, max - min);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((v - min) / span) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = data[data.length - 1];
  const lastX = width - padding;
  const lastY = height - padding - ((last - min) / span) * (height - padding * 2);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]">
      <rect x="0" y="0" width={width} height={height} rx="10" className="fill-white dark:fill-slate-700/30" />
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2.2" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#10b981" />
    </svg>
  );
}

function StatRow({ label, stats, unit = "", intOnly = false }) {
  const show = (n?: number) => (intOnly ? fmtInt(n) : fmt(n));
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-[13px] text-slate-700 dark:text-slate-300">
      <div className="col-span-3 font-medium">{label}</div>
      <div className="rounded-lg border px-2 py-1 bg-white dark:bg-slate-700">ต่ำสุด: {show(stats?.min)}{unit}</div>
      <div className="rounded-lg border px-2 py-1 bg-white dark:bg-slate-700">เฉลี่ย: {show(stats?.avg)}{unit}</div>
      <div className="rounded-lg border px-2 py-1 bg-white dark:bg-slate-700">สูงสุด: {show(stats?.max)}{unit}</div>
    </div>
  );
}
