import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning";
}

export function StatCard({ label, value, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "warning" ? "text-[#fab219]" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="mt-2 text-3xl font-semibold">
        {typeof value === "number" ? value.toLocaleString("bn-BD") : value}
      </div>
    </div>
  );
}
