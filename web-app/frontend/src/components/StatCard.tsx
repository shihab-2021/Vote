import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning";
  /** ছোট, নান্দনিক সজ্জা রেখা -- প্রকৃত টাইম-সিরিজ ট্রেন্ড না (এমন ডেটা নেই), শুধু ভিজ্যুয়াল টেক্সচার */
  sparkline?: boolean;
}

const TONE_COLOR: Record<"default" | "warning", string> = {
  default: "var(--color-primary)",
  warning: "#eda100",
};

export function StatCard({ label, value, icon: Icon, tone = "default", sparkline = false }: StatCardProps) {
  const color = TONE_COLOR[tone];
  return (
    <div className="card-lift rounded-xl border border-kraft/25 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "warning" ? "text-[#eda100]" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="mt-2 text-3xl font-semibold">
        {typeof value === "number" ? value.toLocaleString("bn-BD") : value}
      </div>
      {sparkline && (
        <svg width="100%" height="28" viewBox="0 0 160 28" preserveAspectRatio="none" className="mt-2.5">
          <polyline
            points="0,22 25,16 50,20 80,8 105,14 130,6 160,10"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
        </svg>
      )}
    </div>
  );
}
