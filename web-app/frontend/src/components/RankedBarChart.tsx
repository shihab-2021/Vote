import { useState } from "react";

interface RankedBarChartProps {
  title: string;
  data: Record<string, number>;
  limit?: number;
}

const HUE_LIGHT = "#2a78d6";

export function RankedBarChart({ title, data, limit = 8 }: RankedBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = entries.length ? entries[0][1] : 1;

  if (!entries.length) {
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
      <div className="space-y-2.5">
        {entries.map(([label, value]) => {
          const pct = (value / max) * 100;
          const isHovered = hovered === label;
          return (
            <div
              key={label}
              className="group"
              onMouseEnter={() => setHovered(label)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="mb-0.5 flex items-baseline justify-between text-xs">
                <span className="text-secondary-foreground">{label}</span>
                <span
                  className="tabular-nums text-muted-foreground transition-colors"
                  style={{ color: isHovered ? HUE_LIGHT : undefined }}
                >
                  {value.toLocaleString("bn-BD")}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: HUE_LIGHT,
                    opacity: isHovered ? 1 : 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
