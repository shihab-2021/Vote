import { useQuery } from "@tanstack/react-query";
import { api, type StatsSummary } from "@/lib/api";
import { RankedBarChart } from "@/components/RankedBarChart";
import { DonutChart } from "@/components/DonutChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Masthead } from "@/components/motifs/Masthead";
import { LedgerRow } from "@/components/motifs/LedgerRow";
import { PostalTag } from "@/components/motifs/PostalTag";

function topEntry(data: Record<string, number>): [string, number] | null {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () => api.get<StatsSummary>("/stats/summary").then((r) => r.data),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const wardCount = Object.keys(data.by_ward).length;
  const upazilaCount = Object.keys(data.by_upazila).length;
  const topWard = topEntry(data.by_ward);
  const topUpazila = topEntry(data.by_upazila);
  const today = new Date().toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="ভোটার তথ্য ও সহায়তা প্ল্যাটফর্ম — অভ্যন্তরীণ খতিয়ান"
        title="পরিসংখ্যান ড্যাশবোর্ড"
        meta={
          <div className="flex flex-col items-end gap-1.5 text-right">
            <span className="text-xs text-muted-foreground">{today}</span>
            <span className="flex items-center gap-1.5 rounded-full border border-dashed border-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> আজ হালনাগাদ হয়েছে
            </span>
          </div>
        }
      />

      {/* হিরো ব্যান্ড -- বড় হেডলাইন সংখ্যা + লেজার তালিকা; মোবাইলে উল্লম্বভাবে স্ট্যাক হয় */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <div className="relative flex shrink-0 flex-col justify-center gap-1.5 rounded border border-kraft bg-card p-6 lg:w-[340px]">
          <div className="absolute -top-4 -right-3 flex h-14 w-14 rotate-[8deg] items-center justify-center rounded-full bg-stamp shadow-md">
            <div className="absolute inset-1 rounded-full border border-dashed border-primary-foreground/50" />
            <span className="text-center text-[9px] leading-tight font-bold text-primary-foreground">
              সর্বমোট<br />রেকর্ড
            </span>
          </div>
          <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">মোট নিবন্ধিত ভোটার</div>
          <div className="font-heading text-6xl font-bold tabular-nums text-primary sm:text-7xl">
            {data.total_voters.toLocaleString("bn-BD")}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4 rounded border border-kraft bg-card p-6">
          <LedgerRow label="যাচাই প্রয়োজন" value={data.flagged_count.toLocaleString("bn-BD")} valueClassName="text-destructive" />
          <LedgerRow label="সক্রিয় ওয়ার্ড" value={wardCount.toLocaleString("bn-BD")} />
          <LedgerRow label="সক্রিয় উপজেলা" value={upazilaCount.toLocaleString("bn-BD")} />
        </div>
      </div>

      <div className="h-px bg-[repeating-linear-gradient(to_right,var(--kraft)_0,var(--kraft)_6px,transparent_6px,transparent_12px)]" />

      {/* ফিল্ড রিপোর্ট -- সিল-ফ্রেম ডোনাট + এলাকাভিত্তিক লেজার */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DonutChart title="লিঙ্গ ভিত্তিক বিভাজন" data={data.by_gender} />
        <RankedBarChart title="ওয়ার্ড অনুযায়ী ভোটার" data={data.by_ward} />
      </div>
      <RankedBarChart title="উপজেলা অনুযায়ী ভোটার" data={data.by_upazila} />

      <div className="h-px bg-[repeating-linear-gradient(to_right,var(--kraft)_0,var(--kraft)_6px,transparent_6px,transparent_12px)]" />

      {/* সংক্ষিপ্ত তথ্য -- আসল ডেটা থেকে গণনা করা, কাল্পনিক নয় */}
      {(topWard || topUpazila) && (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">সংক্ষিপ্ত তথ্য</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {topWard && (
              <PostalTag
                label="সর্বোচ্চ ভোটারযুক্ত ওয়ার্ড"
                value={`ওয়ার্ড ${topWard[0]} (${topWard[1].toLocaleString("bn-BD")} জন)`}
                rotate="-rotate-1"
              />
            )}
            {topUpazila && (
              <PostalTag
                label="সর্বোচ্চ ভোটারযুক্ত উপজেলা"
                value={`${topUpazila[0]} (${topUpazila[1].toLocaleString("bn-BD")} জন)`}
                rotate="rotate-1"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
