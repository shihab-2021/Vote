interface ProportionBarProps {
  title: string;
  data: Record<string, number>;
}

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

export function ProportionBar({ title, data }: ProportionBarProps) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (!total) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium">{title}</h3>
        <p className="py-8 text-center text-sm text-muted-foreground">কোনো ডেটা নেই</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {entries.map(([label, value], i) => (
          <div
            key={label}
            style={{ width: `${(value / total) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}
            title={`${label}: ${value.toLocaleString("bn-BD")}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {entries.map(([label, value], i) => (
          <div key={label} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-secondary-foreground">{label}</span>
            <span className="tabular-nums text-muted-foreground">
              {value.toLocaleString("bn-BD")} ({((value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
