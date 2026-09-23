interface DonutChartProps {
  title: string;
  data: Record<string, number>;
}

// এই চার্টের জন্যই নির্দিষ্ট রঙ -- বাকি UI-এর সংযত সবুজ+লাল থেকে আলাদা রাখা হয়েছে, যাতে একাধিক
// ক্যাটেগরি (পুরুষ/মহিলা/...) স্পষ্টভাবে আলাদা করা যায় আর "লাল" ভুল করে বিপদ/ফ্ল্যাগ বোঝাচ্ছে মনে না হয়
const DONUT_COLORS = ["#2563eb", "#db2777", "#16a34a", "#f59e0b", "#7c3aed"];

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
}

export function DonutChart({ title, data }: DonutChartProps) {
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

  const cx = 90, cy = 90, r = 74, inner = 46;
  let cumulative = 0;
  const arcs = entries.map(([label, value], i) => {
    const startA = (cumulative / total) * 2 * Math.PI;
    cumulative += value;
    const endA = (cumulative / total) * 2 * Math.PI;
    const largeArc = endA - startA > Math.PI ? 1 : 0;
    const p1 = polarPoint(cx, cy, r, startA);
    const p2 = polarPoint(cx, cy, r, endA);
    const pi1 = polarPoint(cx, cy, inner, startA);
    const pi2 = polarPoint(cx, cy, inner, endA);
    const d = entries.length === 1
      ? `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} L${cx - 0.01},${cy - inner} A${inner},${inner} 0 1,0 ${cx},${cy - inner} Z`
      : `M${p1.x},${p1.y} A${r},${r} 0 ${largeArc},1 ${p2.x},${p2.y} L${pi2.x},${pi2.y} A${inner},${inner} 0 ${largeArc},0 ${pi1.x},${pi1.y} Z`;
    return { d, color: DONUT_COLORS[i % DONUT_COLORS.length], label, value, pct: (value / total) * 100 };
  });

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <svg width="180" height="180" viewBox="0 0 180 180" className="shrink-0">
          {arcs.map((a) => (
            <path key={a.label} d={a.d} fill={a.color} />
          ))}
          <text x={cx} y={cy - 3} textAnchor="middle" className="fill-foreground text-lg font-bold">
            {total.toLocaleString("bn-BD")}
          </text>
          <text x={cx} y={cy + 15} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            মোট
          </text>
        </svg>
        <div className="flex flex-col gap-2">
          {arcs.map((a) => (
            <div key={a.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: a.color }} />
              <span className="text-secondary-foreground">{a.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {a.value.toLocaleString("bn-BD")} ({a.pct.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
