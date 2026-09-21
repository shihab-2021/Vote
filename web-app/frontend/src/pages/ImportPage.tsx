import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, Loader2, CheckCircle2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api, type ImportBatch, type ImportResult } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ImportPage() {
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: batches } = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => api.get<ImportBatch[]>("/import/batches").then((r) => r.data),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<ImportResult>("/import", form).then((r) => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("ইমপোর্ট সম্পন্ন হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["stats-summary"] });
    },
    onError: () => toast.error("ইমপোর্ট ব্যর্থ হয়েছে -- ফাইলটি সঠিক ফরম্যাটে আছে কিনা যাচাই করুন"),
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    importMutation.mutate(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Excel ইমপোর্ট</h1>
        <p className="text-sm text-muted-foreground">
          vote-2 টুল দিয়ে লোকালি কনভার্ট করা .xlsx ফাইল এখানে আপলোড করুন
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {importMutation.isPending ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
        )}
        <p className="mt-3 font-medium">
          {importMutation.isPending ? "প্রসেস হচ্ছে..." : "ফাইল বেছে নিন অথবা এখানে টেনে আনুন"}
        </p>
        <p className="text-sm text-muted-foreground">শুধু .xlsx / .xls ফরম্যাট সমর্থিত</p>
      </div>

      {result && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
          <div className="text-sm">
            <p className="font-medium">ইমপোর্ট সম্পন্ন</p>
            <p className="text-muted-foreground">
              মোট সারি: {result.total_rows} | নতুন: {result.inserted} | আপডেট: {result.updated} | বাদ
              দেওয়া হয়েছে: {result.errors}
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">ইমপোর্ট ইতিহাস</h2>
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ফাইল</TableHead>
                <TableHead>সময়</TableHead>
                <TableHead className="text-right">মোট সারি</TableHead>
                <TableHead className="text-right">নতুন</TableHead>
                <TableHead className="text-right">আপডেট</TableHead>
                <TableHead className="text-right">বাদ</TableHead>
                <TableHead>অবস্থা</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!batches?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    এখনো কোনো ইমপোর্ট হয়নি
                  </TableCell>
                </TableRow>
              )}
              {batches?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="max-w-[200px] truncate">{b.filename}</TableCell>
                  <TableCell>{new Date(b.imported_at).toLocaleString("bn-BD")}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.row_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.inserted_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.updated_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.error_count}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "done" ? "default" : "destructive"}>{b.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
