interface StatCardProps {
  label: string;
  value: string;
  ok: boolean;
}

export function StatCard({ label, value, ok }: StatCardProps) {
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
