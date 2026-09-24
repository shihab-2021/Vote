import { cn } from "@/lib/utils";

interface PostalTagProps {
  label?: string;
  value: string;
  rotate?: string;
  className?: string;
}

/** পুরনো ডাক/লাগেজ-ট্যাগের অনুভূতি -- ড্যাশড বর্ডার, বাম পাশে সুতো গলানোর ছিদ্র, সামান্য বাঁকানো।
 * Dashboard-এর কার্যক্রম-স্ট্রিপ ও Landing-এর স্মৃতি-স্ট্রিপে ব্যবহৃত। */
export function PostalTag({ label, value, rotate = "-rotate-1", className }: PostalTagProps) {
  return (
    <div
      className={cn(
        "card-lift relative rounded-md border-[1.5px] border-dashed border-kraft bg-card py-3 pr-4 pl-6",
        rotate, className
      )}
    >
      <span className="absolute top-1/2 left-2.5 h-2 w-2 -translate-y-1/2 rounded-full border-[1.5px] border-kraft bg-background" />
      {label && <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>}
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}
