import { useState } from "react";

interface RankedBarChartProps {
  title: string;
  data: Record<string, number>;
  limit?: number;
}

const HUE_LIGHT = "#1F5B3E";

export function RankedBarChart({ title, data, limit = 8 }: RankedBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const entries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = entries.length ? entries[0][1] : 1;

  if (!entries.length) {
    return (
      <div className="rounded border border-kraft bg-card p-5">
        <h3 className="font-heading mb-3 text-base font-bold">{title}</h3>
        <p className="py-8 text-center text-sm text-muted-foreground">কোনো ডেটা নেই</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-kraft bg-card p-5">
      <h3 className="font-heading mb-4 text-base font-bold">{title}</h3>
      <div className="space-y-3.5">
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
              <div className="mb-1 flex items-baseline gap-2 text-sm">
                <span className="whitespace-nowrap text-foreground/80">{label}</span>
                <span className="-translate-y-1 flex-1 border-b border-dotted border-kraft" />
                <span
                  className="font-heading text-base font-bold tabular-nums transition-colors"
                  style={{ color: isHovered ? HUE_LIGHT : undefined }}
                >
                  {value.toLocaleString("bn-BD")}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
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
