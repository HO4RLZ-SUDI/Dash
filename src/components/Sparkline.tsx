interface SparklineProps {
  data?: number[];
  minAuto?: boolean;
  padding?: number;
  width?: number;
  height?: number;
}

export function Sparkline({ data = [], minAuto = false, padding = 2, width = 400, height = 120 }: SparklineProps) {
  if (!data.length) {
    return <div className="h-[120px] grid place-items-center text-sm opacity-60">ไม่มีข้อมูล</div>;
  }

  const min = minAuto ? Math.min(...data) : 0;
  const max = Math.max(...data);
  const span = Math.max(1e-6, max - min);
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const lastX = width - padding;
  const lastY = height - padding - ((last - min) / span) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]">
      <rect x="0" y="0" width={width} height={height} rx="10" className="fill-white dark:fill-slate-700/30" />
      <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2.2" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="#10b981" />
    </svg>
  );
}
