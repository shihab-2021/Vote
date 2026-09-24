interface DonutChartProps {
  title: string;
  data: Record<string, number>;
}

// প্রথম দুটো রঙ প্রাইমারি সবুজ + স্ট্যাম্প লাল (সাধারণত পুরুষ/মহিলা), বাকিগুলো অতিরিক্ত
// ক্যাটেগরির জন্য fallback -- পুরো অ্যাপের নতুন উষ্ণ প্যালেটের সাথে সামঞ্জস্যপূর্ণ
const DONUT_COLORS = ["#1F5B3E", "#A6402E", "#B79362", "#4A6FA5", "#8A6B3F"];

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
}

export function DonutChart({ title, data }: DonutChartProps) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (!total) {
    return (
      <div className="rounded border border-kraft bg-card p-5">
        <h3 className="font-heading mb-3 text-base font-bold">{title}</h3>
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
    <div className="rounded border border-kraft bg-card p-5">
      <h3 className="font-heading mb-4 text-base font-bold">{title}</h3>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        {/* সিল-ফ্রেম -- ড্যাশড রিং, একটা পুরনো মোহর/ওয়াক্স-সিলের অনুভূতি */}
        <div className="relative flex h-[196px] w-[196px] shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-kraft" />
          <svg width="180" height="180" viewBox="0 0 180 180">
            {arcs.map((a) => (
              <path key={a.label} d={a.d} fill={a.color} />
            ))}
            <text x={cx} y={cy - 3} textAnchor="middle" className="font-heading fill-foreground text-lg font-bold">
              {total.toLocaleString("bn-BD")}
            </text>
            <text x={cx} y={cy + 15} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              মোট
            </text>
          </svg>
        </div>
        <div className="flex flex-col gap-2">
          {arcs.map((a) => (
            <div key={a.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
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
