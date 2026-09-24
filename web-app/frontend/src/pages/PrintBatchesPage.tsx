import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Printer, FileClock } from "lucide-react";
import { api, type PrintBatchSummary } from "@/lib/api";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { Masthead } from "@/components/motifs/Masthead";
import { cn } from "@/lib/utils";

function batchStatus(b: PrintBatchSummary) {
  if (b.printed_count === 0) return { label: "প্রিন্টের অপেক্ষায়", tone: "pending" as const };
  if (b.distributed_count >= b.voter_count && b.voter_count > 0) return { label: "সম্পূর্ণ বিতরণ", tone: "done" as const };
  if (b.distributed_count > 0) return { label: "চলমান বিতরণ", tone: "partial" as const };
  return { label: "প্রিন্ট হয়েছে", tone: "printed" as const };
}

const SEAL_STYLE: Record<string, string> = {
  pending: "border-[1.5px] border-dashed border-kraft bg-secondary text-kraft",
  printed: "bg-kraft text-primary-foreground",
  partial: "bg-kraft text-primary-foreground",
  done: "bg-primary text-primary-foreground",
};

export function PrintBatchesPage() {
  const navigate = useNavigate();
  const { data: batches, isLoading } = useQuery({
    queryKey: ["print-batches"],
    queryFn: () => api.get<PrintBatchSummary[]>("/print-batches").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="প্রেরণ কক্ষ"
        title="প্রিন্ট ও বিতরণ"
        subtitle='ভোটার তালিকা পেজে ফিল্টার করে "প্রিন্ট ব্যাচ তৈরি করুন" চাপলে সেই ব্যাচ এখানে দেখা যাবে'
      />

      {!isLoading && !batches?.length && (
        <WarmEmptyState
          icon={Printer}
          title="কোনো প্রিন্ট ব্যাচ নেই"
          subtitle='ভোটার তালিকা পেজ থেকে ফিল্টার করে "প্রিন্ট ব্যাচ তৈরি করুন" চাপুন'
          className="rounded border border-dashed border-kraft"
        />
      )}

      <div className="flex flex-col gap-4">
        {batches?.map((b) => {
          const status = batchStatus(b);
          const pct = b.voter_count ? Math.round((b.distributed_count / b.voter_count) * 100) : 0;
          return (
            <button
              key={b.id}
              onClick={() => navigate(`/print/${b.id}`)}
              className="card-lift flex flex-col gap-4 rounded border border-kraft bg-card p-5 text-left sm:flex-row sm:items-center"
            >
              <div
                className={cn(
                  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
                  SEAL_STYLE[status.tone]
                )}
              >
                {status.tone !== "pending" && (
                  <div className="absolute inset-1 rounded-full border border-dashed border-primary-foreground/50" />
                )}
                {status.tone === "pending" ? (
                  <FileClock className="h-6 w-6" />
                ) : (
                  <span className="text-center text-[9px] leading-tight font-bold">
                    {status.label.split(" ")[0]}<br />{status.label.split(" ")[1] ?? ""}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span className="font-heading truncate text-lg font-bold">{b.label}</span>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  তৈরি হয়েছে: {new Date(b.created_at).toLocaleDateString("bn-BD")} · ব্যাচ #{String(b.id).padStart(2, "0")}
                  {status.tone === "pending" && " · প্রিন্টের অপেক্ষায়"}
                </div>
                {status.tone !== "pending" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", status.tone === "done" ? "bg-primary" : "bg-kraft")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
                      {b.distributed_count.toLocaleString("bn-BD")} / {b.voter_count.toLocaleString("bn-BD")} বিতরণ
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-5 border-t border-dashed border-kraft pt-3 text-center sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                <div>
                  <div className="font-heading text-lg font-bold">{b.voter_count.toLocaleString("bn-BD")}</div>
                  <div className="text-[10px] text-muted-foreground">মোট</div>
                </div>
                <div>
                  <div className="font-heading text-lg font-bold">{b.printed_count.toLocaleString("bn-BD")}</div>
                  <div className="text-[10px] text-muted-foreground">প্রিন্ট</div>
                </div>
                <div>
                  <div className="font-heading text-lg font-bold text-primary">{b.distributed_count.toLocaleString("bn-BD")}</div>
                  <div className="text-[10px] text-muted-foreground">বিতরণ</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
