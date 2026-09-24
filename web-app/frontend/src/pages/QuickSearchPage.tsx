import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, IdCard, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RecordDrawer } from "@/components/RecordDrawer";
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
        <h1 className="text-xl font-semibold">কুইক সার্চ</h1>
        <p className="text-sm text-muted-foreground">ভোটার নং, নাম বা ঠিকানা দিয়ে সঙ্গে সঙ্গে খুঁজুন</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="h-14 pl-11 text-base"
          placeholder="ভোটার নং, নাম বা ঠিকানা লিখুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {!trimmed && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <Search className="h-8 w-8 text-muted-foreground/50" />
          <p>খোঁজা শুরু করতে উপরে টাইপ করুন</p>
        </div>
      )}

      {trimmed && !isFetching && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <p className="font-medium text-foreground">কোনো ফলাফল নেই</p>
          <p className="text-sm">অন্য নাম, ভোটার নং বা ঠিকানা দিয়ে চেষ্টা করুন</p>
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((voter) => (
          <button
            key={voter.id}
            onClick={() => setDetailVoter(voter)}
            className={cn(
              "flex w-full flex-col gap-1.5 rounded-xl border bg-card p-3.5 text-left shadow-sm active:bg-muted/40",
              voter.is_flagged && "border-destructive/30 bg-destructive/5"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium leading-tight">{voter.name || "নাম নেই"}</span>
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
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
