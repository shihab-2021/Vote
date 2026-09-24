import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, type PrintBatchDetail, type PrintItemStatus } from "@/lib/api";

const STATUS_LABEL: Record<PrintItemStatus, string> = {
  pending: "অপেক্ষমাণ",
  printed: "প্রিন্ট হয়েছে",
  distributed: "বিতরণ হয়েছে",
};

export function PrintBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: batch, isLoading } = useQuery({
    queryKey: ["print-batch", id],
    queryFn: () => api.get<PrintBatchDetail>(`/print-batches/${id}`).then((r) => r.data),
  });

  const distributeOne = useMutation({
    mutationFn: (voterId: number) => api.post(`/print-batches/${id}/items/${voterId}/distribute`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["print-batch", id] }),
    onError: () => toast.error("আপডেট করা যায়নি"),
  });

  const distributeAll = useMutation({
    mutationFn: () => api.post(`/print-batches/${id}/distribute-all`),
    onSuccess: () => {
      toast.success("সব বিতরণ হিসেবে চিহ্নিত হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["print-batch", id] });
    },
    onError: () => toast.error("আপডেট করা যায়নি"),
  });

  if (isLoading || !batch) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="ব্যাক" onClick={() => navigate("/print")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{batch.label}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(batch.created_at).toLocaleString("bn-BD")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-semibold">{batch.voter_count}</div>
          <div className="text-xs text-muted-foreground">মোট ভোটার</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-semibold">{batch.printed_count}</div>
          <div className="text-xs text-muted-foreground">প্রিন্ট হয়েছে</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-semibold">{batch.distributed_count}</div>
          <div className="text-xs text-muted-foreground">বিতরণ হয়েছে</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => window.open(`/api/print-batches/${id}/pdf`, "_blank")}>
          <Download className="h-4 w-4" /> PDF ডাউনলোড করুন
        </Button>
        <Button
          variant="outline"
          onClick={() => distributeAll.mutate()}
          disabled={distributeAll.isPending || batch.distributed_count === batch.voter_count}
        >
          {distributeAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          সব বিতরণ হয়েছে চিহ্নিত করুন
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>নাম</TableHead>
              <TableHead>ভোটার নং</TableHead>
              <TableHead>ঠিকানা</TableHead>
              <TableHead>অবস্থা</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-xs">{item.voter_no || "—"}</TableCell>
                <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                  {item.address || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={item.status === "pending" ? "secondary" : "default"}>
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost" size="sm"
                    disabled={item.status === "distributed" || distributeOne.isPending}
                    onClick={() => distributeOne.mutate(item.voter_id)}
                  >
                    বিতরণ করা হয়েছে
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
