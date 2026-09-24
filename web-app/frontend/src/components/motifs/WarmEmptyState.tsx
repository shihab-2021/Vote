import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StampBadge } from "./StampBadge";

interface WarmEmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
}

/** টেবিল/তালিকা খালি থাকলে দেখানোর জন্য একটা ভাগ করা "উষ্ণ" খালি-অবস্থা -- plain ধূসর টেক্সটের
 * বদলে। VotersPage/PrintBatchesPage/UsersPage/AuditLogPage/FieldsPage/QuickSearchPage-এ
 * ডুপ্লিকেট হওয়া "কোনো ... নেই" ব্লকগুলোর জায়গায় ব্যবহৃত। children দিয়ে ঐচ্ছিক অ্যাকশন
 * (যেমন "সব ফিল্টার মুছুন" বাটন) যোগ করা যায়। */
export function WarmEmptyState({ icon, title, subtitle, className, children }: WarmEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <StampBadge icon={icon} size="md" className="bg-muted text-muted-foreground/80" />
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
