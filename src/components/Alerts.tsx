interface AlertsProps {
  items: string[];
}

export function Alerts({ items }: AlertsProps) {
  const hasAlerts = items.length > 0;
  return (
    <div
      className={`rounded-2xl p-4 border ${
        hasAlerts ? "border-amber-300 bg-amber-50/70 dark:bg-yellow-900/30" : "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/30"
      }`}
    >
      <div className="font-semibold mb-1">{hasAlerts ? "⚠️ ควรตรวจสอบ" : "✅ ปกติทุกค่า"}</div>
      {hasAlerts ? (
        <ul className="list-disc pl-5 text-sm space-y-1">
          {items.map((alert, index) => (
            <li key={index}>{alert}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm opacity-80">ทุกค่าภายในเกณฑ์แนะนำ เหมาะต่อการเจริญเติบโตของพืช 🌿</div>
      )}
    </div>
  );
}
