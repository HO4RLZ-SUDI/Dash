import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { Alerts } from "./components/Alerts";
import { GaugeHalf } from "./components/GaugeHalf";
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

  const { current: cur, summaries, online } = useSensorData();
  const sumHour = summaries?.hour ?? null;
  const sumDay = summaries?.day ?? null;


  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<Bubble[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loadingAI]);

  const rangeOK = useMemo(() => okRange(cur), [cur]);

  const alerts = useMemo(() => {
    if (!cur) return [] as string[];
    const arr: string[] = [];
    if (!rangeOK.temp) arr.push(`🌡️ อุณหภูมิ ${cur.temperature}°C นอกช่วงแนะนำ (25–32°C)`);
    if (!rangeOK.hum) arr.push(`💧 ความชื้น ${cur.humidity}% นอกช่วงแนะนำ (65–80%)`);
    if (!rangeOK.tds) arr.push(`⚗️ TDS ${cur.tds} ppm นอกช่วงแนะนำ (900–1200 ppm)`);
    if (!rangeOK.ph) arr.push(`🧪 pH ${cur.ph} นอกช่วงแนะนำ (5.8–6.8)`);
    return arr;
  }, [cur, rangeOK]);

  const send = async () => {
    const q = msg.trim();
    if (!q) return;
    setChat((c) => [...c, { role: "user", text: q }]);
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
    <div
      className={`min-h-screen font-[Kanit] transition-colors duration-500 ${
        dark ? "bg-[#1A1A1A] text-[#F5EFD7]" : "bg-[#FAFCF8] text-[#2E2E2E]"
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-40 backdrop-blur border-b ${
          dark
            ? "bg-[#1C1C1C]/90 border-[#3A3A3A]"
            : "bg-[#FAFCF8]/80 border-[#E5EDE4]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-lg grid place-items-center text-white font-bold shadow-md ${
                dark
                  ? "bg-gradient-to-r from-[#BFA84E] to-[#E6C975]"
                  : "bg-gradient-to-r from-[#5CC488] to-[#C2E67E]"
              }`}
            >
              iH
            </div>
            <div
              className={`font-semibold tracking-tight text-lg ${
                dark ? "text-[#E6C975]" : "text-[#366B48]"
              }`}
            >
              iHydro Dashboard
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                online
                  ? dark
                    ? "bg-[#E6C975]"
                    : "bg-[#6BCB93]"
                  : dark
                  ? "bg-[#A84A3E]"
                  : "bg-[#D45E57]"
              }`}
            />
            <span className="opacity-80">{online ? "Online" : "Offline"}</span>
            <button
              onClick={toggleDark}
              className={`ml-3 px-3 py-1 text-xs border rounded-full transition ${
                dark
                  ? "border-[#E6C975]/50 text-[#E6C975] hover:bg-[#2A2A2A]"
                  : "border-[#A3C7AA] hover:bg-[#E4F1E7]"
              }`}
            >
              {dark ? "☀️ โหมดสว่าง" : "🌙 โหมดมืด"}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
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
            <Panel title="🌡️ อุณหภูมิ (°C)">
  <div className="w-full">
    <GaugeHalf
      value={cur?.temperature}
      min={20}
      max={40}
      label="อุณหภูมิ (°C)"
      color={dark ? "#E6C975" : "#5CC488"}
      dark={dark}
    />
  </div>
  <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.temperature} unit="°C" />
  <StatRow label="วันนี้" stats={sumDay?.stats.temperature} unit="°C" />
</Panel>

<Panel title="💧 ความชื้น (%)">
  <div className="w-full">
    <GaugeHalf
      value={cur?.humidity}
      min={40}
      max={100}
      label="ความชื้น (%)"
      color={dark ? "#E6C975" : "#50C878"}
      dark={dark}
    />
  </div>
  <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.humidity} unit="%" />
  <StatRow label="วันนี้" stats={sumDay?.stats.humidity} unit="%" />
</Panel>

<Panel title="⚗️ TDS (ppm)">
  <div className="w-full">
    <GaugeHalf
      value={cur?.tds}
      min={500}
      max={1500}
      label="TDS (ppm)"
      color={dark ? "#E6C975" : "#007AFF"}
      dark={dark}
    />
  </div>
  <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.tds} unit=" ppm" intOnly />
  <StatRow label="วันนี้" stats={sumDay?.stats.tds} unit=" ppm" intOnly />
</Panel>

<Panel title="🧪 pH">
  <div className="w-full">
    <GaugeHalf
      value={cur?.ph}
      min={4}
      max={8}
      label="pH"
      color={dark ? "#E6C975" : "#9B59B6"}
      dark={dark}
    />
  </div>
  <StatRow label="ชั่วโมงนี้" stats={sumHour?.stats.ph} />
  <StatRow label="วันนี้" stats={sumDay?.stats.ph} />
</Panel>

          </div>
        </section>

        <aside className="space-y-4">
          {/* AI Chat */}
          <div
            className={`rounded-2xl p-4 border transition ${
              dark
                ? "border-[#3A3A3A] bg-[#1E1E1E]"
                : "border-[#DDEEE0] bg-[#FFFFFF]"
            }`}
          >
            <div
              className={`font-semibold mb-2 ${
                dark ? "text-[#E6C975]" : "text-[#366B48]"
              }`}
            >
              🤖 ผู้ช่วย iHydro AI
            </div>
            <div className="h-72 overflow-y-auto space-y-2 pr-1">
              {chat.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`px-3 py-2 rounded-2xl max-w-[85%] ${
                    m.role === "user"
                      ? dark
                        ? "ml-auto bg-[#E6C975]/20 text-[#E6C975]"
                        : "ml-auto bg-[#E6F8EB] text-[#2E2E2E]"
                      : dark
                      ? "bg-[#2B2B2B] text-[#F1EBD6]"
                      : "bg-[#F5F8F5] text-[#2E2E2E]"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {loadingAI && <div className="text-sm opacity-70">🤖 กำลังพิมพ์คำตอบ...</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={`flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 ${
                  dark
                    ? "border-[#3A3A3A] bg-[#2B2B2B] text-[#E6C975] focus:ring-[#E6C975]/40"
                    : "border-[#DDEEE0] bg-white focus:ring-emerald-300"
                }`}
                placeholder="พิมพ์เช่น: แนะนำการปรับ pH..."
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                onClick={send}
                disabled={loadingAI}
                className={`px-4 py-2 rounded-xl font-medium text-white hover:shadow-lg disabled:opacity-50 ${
                  dark
                    ? "bg-gradient-to-r from-[#BFA84E] to-[#E6C975]"
                    : "bg-gradient-to-r from-[#5CC488] to-[#C2E67E]"
                }`}
              >
                ส่ง
              </button>
            </div>
          </div>

          {/* Summary */}
          <div
            className={`rounded-2xl p-4 border ${
              dark
                ? "border-[#3A3A3A] bg-[#222222]"
                : "border-[#DDEEE0] bg-[#F1F9F3]"
            }`}
          >
            <div
              className={`font-semibold mb-1 ${
                dark ? "text-[#E6C975]" : "text-[#366B48]"
              }`}
            >
              ภาพรวมเร็ว 🌿
            </div>
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
    <div className="border rounded-2xl p-3 transition shadow-sm dark:shadow-[0_0_15px_rgba(230,201,117,0.15)] border-[#DDEEE0] dark:border-[#3A3A3A] bg-white/95 dark:bg-[#1F1F1F] hover:shadow-lg">
      <div className="text-sm font-medium mb-2 text-[#366B48] dark:text-[#E6C975]">{title}</div>
      {children}
    </div>
  );
}

function StatRow({
  label,
  stats,
  unit = "",
  intOnly = false,
}: {
  label: string;
  stats?: SummaryStat | null;
  unit?: string;
  intOnly?: boolean;
}) {
  const show = (n?: number | null) => (intOnly ? fmtInt(n) : fmt(n));
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-[13px] text-[#366B48] dark:text-[#E6C975]">
      <div className="col-span-3 font-medium">{label}</div>
      <div className="rounded-lg border px-2 py-1 bg-[#FFFFFF] dark:bg-[#2B2B2B] border-[#DDEEE0] dark:border-[#3A3A3A]">
        ต่ำสุด: {show(stats?.min)}
        {unit}
      </div>
      <div className="rounded-lg border px-2 py-1 bg-[#FFFFFF] dark:bg-[#2B2B2B] border-[#DDEEE0] dark:border-[#3A3A3A]">
        เฉลี่ย: {show(stats?.avg)}
        {unit}
      </div>
      <div className="rounded-lg border px-2 py-1 bg-[#FFFFFF] dark:bg-[#2B2B2B] border-[#DDEEE0] dark:border-[#3A3A3A]">
        สูงสุด: {show(stats?.max)}
        {unit}
      </div>
    </div>
  );
}
