import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MastheadProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/** পুরনো সংবাদপত্র/গেজেটের মাস্টহেড-এর মতো পেজ-হেডার -- দুটো সরু রেখার মাঝে সেরিফ টাইটেল।
 * Dashboard/Voters/PrintBatches/Landing-এ পুনর্ব্যবহৃত, প্রতিটা পেজের নিজস্ব শিরোনাম/সাবটাইটেল/
 * অ্যাকশন বাটন দিয়ে। */
export function Masthead({ eyebrow, title, subtitle, actions, meta, className }: MastheadProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative h-[3px] bg-foreground">
        <div className="absolute inset-x-0 top-[5px] h-px bg-foreground" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 py-1">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-[10.5px] font-semibold tracking-widest text-muted-foreground uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold sm:text-[28px]">{title}</h1>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</div>}
        </div>
        {(actions || meta) && (
          <div className="flex flex-col items-end gap-2">
            {meta}
            {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
          </div>
        )}
      </div>
      <div className="relative h-[3px] bg-foreground">
        <div className="absolute inset-x-0 -top-[5px] h-px bg-foreground" />
      </div>
    </div>
  );
}
