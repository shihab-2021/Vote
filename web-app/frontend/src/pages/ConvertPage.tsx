import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Folder, FileText, CornerLeftUp, Loader2, CheckCircle2, AlertTriangle, DatabaseZap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  api, type BrowseResponse, type ConvertStatus, type ConvertProgress,
  type ConvertResult, type ConvertPreview, type ConvertCommitResult,
} from "@/lib/api";

export function ConvertPage() {
  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [progress, setProgress] = useState<ConvertProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<ConvertResult | null>(null);
  const [commitResult, setCommitResult] = useState<ConvertCommitResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const { data: convertStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["convert-status"],
    queryFn: () => api.get<ConvertStatus>("/convert/status").then((r) => r.data),
  });

  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ["convert-browse", path],
    queryFn: () => api.get<BrowseResponse>("/convert/browse", { params: { path } }).then((r) => r.data),
    enabled: !!convertStatus?.available,
  });

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["convert-preview", jobId],
    queryFn: () => api.get<ConvertPreview>(`/convert/jobs/${jobId}/preview`).then((r) => r.data),
    enabled: !!jobId && !!extractResult && !commitResult,
  });

  const commitMutation = useMutation({
    mutationFn: () => api.post<ConvertCommitResult>(`/convert/jobs/${jobId}/commit`).then((r) => r.data),
    onSuccess: (data) => {
      setCommitResult(data);
      toast.success("ডাটাবেজে যোগ হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["stats-summary"] });
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
    },
    onError: () => toast.error("ডাটাবেজে যোগ করা যায়নি"),
  });

  const discardMutation = useMutation({
    mutationFn: () => api.post(`/convert/jobs/${jobId}/discard`),
    onSuccess: () => {
      toast("বাতিল করা হয়েছে -- Excel ফাইলটি ডেস্কটপে থেকে গেছে");
      resetAll();
    },
  });

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  function resetAll() {
    setJobId(null);
    setExtractResult(null);
    setCommitResult(null);
    setProgress(null);
    setError("");
    setSelectedPdf(null);
  }

  async function startConvert() {
    if (!selectedPdf) return;
    setRunning(true);
    setExtractResult(null);
    setCommitResult(null);
    setError("");
    setProgress(null);
    try {
      const res = await api.post<{ job_id: string }>("/convert/start", { pdf_path: selectedPdf });
      setJobId(res.data.job_id);
      const es = new EventSource(`/api/convert/jobs/${res.data.job_id}/stream`);
      esRef.current = es;
      es.onmessage = (evt) => {
        const payload = JSON.parse(evt.data);
        if (payload.progress) setProgress(payload.progress);
        if (payload.status === "done") {
          es.close();
          setRunning(false);
          setExtractResult(payload.result);
        } else if (payload.status === "error") {
          es.close();
          setRunning(false);
          setError(payload.error || "অজানা ত্রুটি");
        }
      };
      es.onerror = () => {
        es.close();
        setRunning(false);
      };
    } catch (e: any) {
      setRunning(false);
      setError(e?.response?.data?.detail || "কনভার্সন শুরু করা যায়নি");
    }
  }

  if (statusLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!convertStatus?.available) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">PDF কনভার্ট</h1>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium">এই সার্ভারে PDF কনভার্সন সুবিধা নেই</p>
            <p className="mt-1 text-muted-foreground">
              OCR লাইব্রেরি (easyocr, pymupdf ইত্যাদি) শুধু লোকাল ইনস্টলেশনে থাকে। এই অ্যাপটি
              আপনার নিজের কম্পিউটারে চালান (README.md দেখুন) তাহলে এই পেজ থেকেই PDF কনভার্ট করতে
              পারবেন। এর বদলে "ইমপোর্ট" পেজ থেকে আগে থেকে কনভার্ট করা Excel ফাইলও আপলোড করতে পারেন।
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">PDF কনভার্ট</h1>
        <p className="text-sm text-muted-foreground">
          PDF থেকে ডেটা বের করে আগে দেখাবে -- আপনি দেখে নিশ্চিত করলে তবেই ডাটাবেজে যোগ হবে
        </p>
      </div>

      {!jobId && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">১. PDF ফাইল বাছাই করুন</h2>
          <div className="mb-2 truncate text-xs text-muted-foreground">{browseData?.path || "রুট"}</div>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {browseLoading && <div className="p-4"><Skeleton className="h-6 w-full" /></div>}
            {!browseLoading && browseData?.parent !== undefined && browseData.parent !== null && (
              <div
                className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm hover:bg-accent"
                onClick={() => setPath(browseData.parent!)}
              >
                <CornerLeftUp className="h-4 w-4 text-muted-foreground" /> .. (উপরে যান)
              </div>
            )}
            {!browseLoading && browseData?.entries.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">কোনো সাব-ফোল্ডার বা PDF নেই</div>
            )}
            {!browseLoading &&
              browseData?.entries.map((entry) => (
                <div
                  key={entry.path}
                  onClick={() => (entry.type === "dir" ? setPath(entry.path) : setSelectedPdf(entry.path))}
                  className={`flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent ${
                    selectedPdf === entry.path ? "bg-accent" : ""
                  }`}
                >
                  {entry.type === "dir" ? (
                    <Folder className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">{entry.name}</span>
                  {entry.size_mb !== undefined && (
                    <span className="text-xs text-muted-foreground">{entry.size_mb} MB</span>
                  )}
                </div>
              ))}
          </div>
          {selectedPdf && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2">
              <span className="flex-1 truncate text-xs">{selectedPdf}</span>
              <Button size="sm" onClick={startConvert} disabled={running}>
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
                কনভার্ট শুরু করুন
              </Button>
            </div>
          )}
        </div>
      )}

      {jobId && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">২. প্রগ্রেস ও প্রিভিউ</h2>
            {(extractResult || error) && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                নতুন কনভার্সন
              </Button>
            )}
          </div>

          {running && progress && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="পেজ" value={`${progress.page}/${progress.total_pages}`} />
              <StatBox label="সেল (এই পেজে)" value={`${progress.cell}/${progress.total_cells}`} />
              <StatBox label="ভোটার সংগৃহীত" value={progress.voters} />
              <StatBox label="সময় চলছে" value={`${(progress.elapsed / 60).toFixed(1)} মিনিট`} />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {extractResult && !commitResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-blue-600" />
                <div className="text-sm">
                  <p className="font-medium">এক্সট্র্যাকশন সম্পন্ন -- এখনো ডাটাবেজে যোগ হয়নি</p>
                  <p className="text-muted-foreground">
                    {extractResult.total_voters} জন ভোটার পাওয়া গেছে ({extractResult.flagged} জন যাচাই
                    প্রয়োজন) | সময় লেগেছে {extractResult.elapsed_minutes} মিনিট
                  </p>
                  {extractResult.excel_path && (
                    <p className="mt-1 text-xs text-muted-foreground">Excel ব্যাকআপ: {extractResult.excel_path}</p>
                  )}
                </div>
              </div>

              {extractResult.total_voters > 0 && (
                <>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      প্রথম {preview?.rows.length ?? 0} জনের প্রিভিউ (মোট {preview?.total ?? extractResult.total_voters} জন)
                    </p>
                    <div className="overflow-auto rounded-lg border">
                      {previewLoading && <div className="p-4"><Skeleton className="h-24 w-full" /></div>}
                      {preview && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {preview.columns.map((c) => (
                                <TableHead key={c.key}>{c.label}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview.rows.map((row, i) => (
                              <TableRow key={i} className={row["_flag"] ? "bg-destructive/5" : ""}>
                                {preview.columns.map((c) => (
                                  <TableCell key={c.key} className="max-w-40 truncate text-xs">
                                    {c.key === "_flag" ? (
                                      row[c.key] ? <Badge variant="destructive" className="text-[10px] font-normal">{row[c.key]}</Badge> : ""
                                    ) : (
                                      row[c.key]
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
                      {commitMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DatabaseZap className="h-4 w-4" />
                      )}
                      ডাটাবেজে যোগ করুন
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => discardMutation.mutate()}
                      disabled={discardMutation.isPending}
                    >
                      বাতিল করুন
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {commitResult && (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div className="text-sm">
                <p className="font-medium">ডাটাবেজে যোগ হয়েছে!</p>
                <p className="text-muted-foreground">
                  নতুন {commitResult.inserted} জন, আপডেট {commitResult.updated} জন
                  {commitResult.errors > 0 && `, বাদ দেওয়া হয়েছে ${commitResult.errors} জন`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
