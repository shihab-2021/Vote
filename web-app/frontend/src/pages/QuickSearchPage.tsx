import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, IdCard, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RecordDrawer } from "@/components/RecordDrawer";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { cn } from "@/lib/utils";
import { api, type Voter, type VoterListResponse } from "@/lib/api";

/** "অপারেশনস/ফিল্ড" ভূমিকার জন্য দ্রুত এক-বাক্স সার্চ -- VotersPage-এর ফিল্টার/বাল্ক-এডিট/এক্সপোর্ট
 * ছাড়াই, শুধু খুঁজুন -> ফলাফল -> বিস্তারিত। নির্বাচনের দিনে সেকেন্ডে একজন ভোটার খুঁজে পাওয়াই লক্ষ্য। */
export function QuickSearchPage() {
  const [search, setSearch] = useState("");
  const [detailVoter, setDetailVoter] = useState<Voter | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["quick-search", search],
    queryFn: () => api.get<VoterListResponse>("/voters", {
      params: { search, page: 1, page_size: 30 },
    }).then((r) => r.data),
    enabled: search.trim().length > 0,
    placeholderData: (prev) => prev,
  });

  const trimmed = search.trim();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold">কুইক সার্চ</h1>
        <p className="text-sm text-muted-foreground">ভোটার নং, নাম বা ঠিকানা দিয়ে সঙ্গে সঙ্গে খুঁজুন</p>
      </div>

      <div className="relative rounded border-[1.5px] border-dashed border-kraft bg-card">
        <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="h-14 border-0 bg-transparent pl-12 text-base"
          placeholder="ভোটার নং, নাম বা ঠিকানা লিখুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isFetching && (
          <Loader2 className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {!trimmed && (
        <div className="flex flex-col items-center gap-2 rounded border border-dashed border-kraft py-16 text-center text-muted-foreground">
          <Search className="h-8 w-8 text-muted-foreground/50" />
          <p>খোঁজা শুরু করতে উপরে টাইপ করুন</p>
        </div>
      )}

      {trimmed && !isFetching && data?.items.length === 0 && (
        <WarmEmptyState
          icon={Search}
          title="কোনো ফলাফল নেই"
          subtitle="অন্য নাম, ভোটার নং বা ঠিকানা দিয়ে চেষ্টা করুন"
          className="rounded-xl border border-dashed"
        />
      )}

      <div className="space-y-2.5">
        {data?.items.map((voter) => (
          <button
            key={voter.id}
            onClick={() => setDetailVoter(voter)}
            className={cn(
              "relative flex w-full flex-col gap-1.5 rounded border bg-card p-3.5 pt-4 text-left shadow-sm active:bg-muted/40",
              voter.is_flagged ? "border-destructive/40 bg-destructive/5" : "border-kraft"
            )}
          >
            {/* ইনডেক্স-কার্ডের নচ ট্যাব */}
            <span
              className={cn(
                "absolute top-0 right-4 h-3.5 w-7 rounded-b border-x border-b",
                voter.is_flagged ? "border-destructive/40 bg-destructive/10" : "border-kraft bg-secondary"
              )}
            />
            <div className="flex items-start justify-between gap-2">
              <span className="font-heading font-bold leading-tight">{voter.name || "নাম নেই"}</span>
              {voter.is_flagged && (
                <Badge variant="destructive" className="shrink-0 text-[10px] font-normal">
                  যাচাই প্রয়োজন
                </Badge>
              )}
            </div>
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{voter.address || "ঠিকানা নেই"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dotted border-kraft pt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 tabular-nums">
                <IdCard className="h-3 w-3" /> {voter.voter_no || "—"}
              </span>
              {voter.ward && <span>ওয়ার্ড {voter.ward}</span>}
              {voter.gender && <span>{voter.gender}</span>}
            </div>
          </button>
        ))}
      </div>

      <RecordDrawer voter={detailVoter} onClose={() => setDetailVoter(null)} />
    </div>
  );
}
