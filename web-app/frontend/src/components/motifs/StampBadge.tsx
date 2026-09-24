import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StampBadgeProps {
  icon: LucideIcon;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: { box: "h-9 w-9", icon: "h-4 w-4", ring: "inset-0.5" },
  md: { box: "h-14 w-14", icon: "h-6 w-6", ring: "inset-1" },
  lg: { box: "h-16 w-16", icon: "h-8 w-8", ring: "inset-1.5" },
} as const;

/** পুরনো ডাক-স্ট্যাম্প/সিলের অনুভূতি দেওয়া একটা গোল ব্যাজ -- ভিতরে একটা ড্যাশড রিং, যেকোনো আইকন
 * মুড়িয়ে দেখানো যায়। Vote আইকন, ভেরিফাইড-রেজাল্ট আইকন, খালি-অবস্থার আইকন -- সব জায়গায় পুনর্ব্যবহারযোগ্য। */
export function StampBadge({ icon: Icon, className, size = "md" }: StampBadgeProps) {
  const s = SIZE_MAP[size];
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm",
        s.box, className
      )}
    >
      <div className={cn("absolute rounded-full border border-dashed border-primary-foreground/40", s.ring)} />
      <Icon className={s.icon} />
    </div>
  );
}
