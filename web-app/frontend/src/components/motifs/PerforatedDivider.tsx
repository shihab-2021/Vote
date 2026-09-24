import { cn } from "@/lib/utils";

/** পুরনো টিকিট/স্ট্যাম্প-শিটের ছেঁড়া-রেখার অনুভূতি দেওয়া একটা হালকা ড্যাশড ডিভাইডার --
 * সেকশন ভাগ করার জন্য, --kraft টোকেন ব্যবহার করে (index.css)। */
export function PerforatedDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)} aria-hidden="true">
      <div className="h-0 w-full border-t-2 border-dashed border-kraft/60" />
    </div>
  );
}
