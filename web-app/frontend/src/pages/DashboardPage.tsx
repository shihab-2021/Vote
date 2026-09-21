import { useQuery } from "@tanstack/react-query";
import { Users, AlertTriangle } from "lucide-react";
import { api, type StatsSummary } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { RankedBarChart } from "@/components/RankedBarChart";
import { ProportionBar } from "@/components/ProportionBar";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () => api.get<StatsSummary>("/stats/summary").then((r) => r.data),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ড্যাশবোর্ড</h1>
        <p className="text-sm text-muted-foreground">সামগ্রিক পরিসংখ্যান</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="মোট ভোটার" value={data.total_voters} icon={Users} />
        <StatCard
          label="যাচাই প্রয়োজন"
          value={data.flagged_count}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankedBarChart title="ওয়ার্ড অনুযায়ী ভোটার" data={data.by_ward} />
        <RankedBarChart title="উপজেলা অনুযায়ী ভোটার" data={data.by_upazila} />
      </div>

      <ProportionBar title="লিঙ্গ ভিত্তিক বিভাজন" data={data.by_gender} />
    </div>
  );
}
