import GaugeChart from "react-gauge-chart";

interface GaugeHalfProps {
  value?: number;
  min: number;
  max: number;
  label: string;
  color?: string;
  dark?: boolean;
}

export function GaugeHalf({ value = 0, min, max, label, color = "#5CC488", dark }: GaugeHalfProps) {
  const percent = (value - min) / (max - min);
  return (
    <div className="flex flex-col items-center">
      <GaugeChart
        id={`gauge-${label}`}
        nrOfLevels={20}
        percent={Math.min(Math.max(percent, 0), 1)}
        arcsLength={[1]}
        colors={[color]}
        textColor={dark ? "#E6C975" : "#333"}
        formatTextValue={() => value.toFixed(1)}
        needleColor={dark ? "#E6C975" : "#333"}
        animate={false}
      />
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </div>
  );
}
