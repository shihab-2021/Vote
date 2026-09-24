import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LedgerRowProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  className?: string;
}

/** পুরনো হিসাবের খাতার মতো লেবেল...মান সারি (ডটেড লিডার সহ) -- Dashboard-এর হিরো তালিকা,
 * এলাকা-বিভাজন, Landing-এর ফিচার তালিকায় বক্সের বদলে ব্যবহৃত। */
export function LedgerRow({ label, value, valueClassName, className }: LedgerRowProps) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-sm whitespace-nowrap text-foreground/80">{label}</span>
      <span className="-translate-y-1 flex-1 border-b border-dotted border-kraft" />
      <span className={cn("font-heading text-lg font-bold tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}
