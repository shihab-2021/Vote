import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Folder, FileText, CornerLeftUp, Loader2, CheckCircle2, AlertTriangle, DatabaseZap, Octagon,
  FolderTree,
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
  type ConvertActiveResponse, type BatchActiveResponse, type BatchFileStatus,
} from "@/lib/api";

const BATCH_STATUS_LABEL: Record<BatchFileStatus, string> = {
  pending: "অপেক্ষমাণ",
  running: "চলছে...",
  done: "✓ সম্পন্ন",
  error: "✗ ব্যর্থ",
  cancelled: "থামানো হয়েছে",
  skipped: "এড়ানো হয়েছে",
};

function baseName(p: string) {
  return p.split(/[\\/]/).pop() || p;
}

export function ConvertPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [path, setPath] = useState("");
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [progress, setProgress] = useState<ConvertProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<ConvertResult | null>(null);
  const [commitResult, setCommitResult] = useState<ConvertCommitResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [batchStarting, setBatchStarting] = useState(false);
  const [batchStopping, setBatchStopping] = useState(false);
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

  // পেজ লোড/রিলোড/ট্যাব-সুইচের পরও চলমান বা রিভিউ-অপেক্ষমাণ কনভার্সন থাকলে তাতে রিকানেক্ট করে --
  // ব্যাকএন্ডে কনভার্সন background thread-এ চলে বলে ট্যাব বন্ধ/রিলোডে থেমে যায় না, শুধু আগে
  // এই পেজের React state-টাই হারিয়ে যেত।
  useEffect(() => {
    if (!convertStatus?.available) return;
    let ignore = false;
    api.get<ConvertActiveResponse>("/convert/active").then((res) => {
      if (ignore) return;
      const job = res.data;
      if (!job.job_id) return;
      setJobId(job.job_id);
      if (job.status === "done") {
        setExtractResult(job.result ?? null);
      } else if (job.status === "error") {
        setError(job.error || "অজানা ত্রুটি");
      } else if (job.status === "cancelled") {
        setCancelled(true);
      } else {
        // starting / running / cancelling
        setRunning(true);
        setProgress(job.progress ?? null);
        if (job.status === "cancelling") setStopping(true);
        listenToJob(job.job_id);
      }
    }).catch(() => {});
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convertStatus?.available]);

  // ব্যাচ কনভার্সনের অবস্থা পোল করে -- এটা দিনের পর দিন চলতে পারে বলে SSE-এর বদলে সাধারণ
  // পোলিং, চলমান/থামছে অবস্থায়ই শুধু পোল করে, শেষ হয়ে গেলে থেমে যায়।
  const { data: batchActive } = useQuery({
    queryKey: ["convert-batch-active"],
    queryFn: () => api.get<BatchActiveResponse>("/convert/batch/active").then((r) => r.data),
    enabled: !!convertStatus?.available,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "running" || s === "cancelling" ? 3000 : false;
    },
  });

  // পেজ রিলোড/দিন পরে ফিরে আসার সময় সত্যিকারের চলমান ব্যাচ থাকলে সেই ট্যাবেই নিয়ে যায়
  useEffect(() => {
    if (batchActive?.batch_id && (batchActive.status === "running" || batchActive.status === "cancelling")) {
      setMode("batch");
    }
  }, [batchActive?.batch_id, batchActive?.status]);

  async function startBatch() {
    if (!browseData?.path) return;
    setBatchStarting(true);
    try {
      const res = await api.post<{ batch_id: string; total_files: number }>(
        "/convert/batch/start", { folder_path: browseData.path },
      );
      toast.success(`${res.data.total_files}টি PDF পাওয়া গেছে -- ব্যাচ কনভার্সন শুরু হয়েছে`);
      queryClient.invalidateQueries({ queryKey: ["convert-batch-active"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "ব্যাচ শুরু করা যায়নি");
    } finally {
      setBatchStarting(false);
    }
  }

  async function stopBatch() {
    setBatchStopping(true);
    try {
      await api.post("/convert/batch/stop");
      queryClient.invalidateQueries({ queryKey: ["convert-batch-active"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "থামানো যায়নি");
    } finally {
      setBatchStopping(false);
    }
  }

  async function resetBatch() {
    await api.post("/convert/batch/discard").catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["convert-batch-active"] });
  }

  function resetAll() {
    // ব্যাকএন্ডেও job মুছে ফেলা হয়, নাহলে রিলোডের পর /active থেকে এই পুরনো
    // (বাতিল করা/এরর হওয়া) job-টাই আবার ফিরে আসবে
    if (jobId) api.post(`/convert/jobs/${jobId}/discard`).catch(() => {});
    setJobId(null);
    setExtractResult(null);
    setCommitResult(null);
    setProgress(null);
    setError("");
    setCancelled(false);
    setStopping(false);
    setSelectedPdf(null);
  }

  function listenToJob(id: string) {
    const es = new EventSource(`/api/convert/jobs/${id}/stream`);
    esRef.current = es;
    es.onmessage = (evt) => {
      const payload = JSON.parse(evt.data);
      if (payload.progress) setProgress(payload.progress);
      if (payload.status === "cancelling") {
        setStopping(true);
      } else if (payload.status === "done") {
        es.close();
        setRunning(false);
        setStopping(false);
        setExtractResult(payload.result);
      } else if (payload.status === "error") {
        es.close();
        setRunning(false);
        setStopping(false);
        setError(payload.error || "অজানা ত্রুটি");
      } else if (payload.status === "cancelled") {
        es.close();
        setRunning(false);
        setStopping(false);
        setCancelled(true);
      }
    };
    es.onerror = () => {
      es.close();
      setRunning(false);
    };
  }

  async function startConvert() {
    if (!selectedPdf) return;
    setRunning(true);
    setExtractResult(null);
    setCommitResult(null);
    setError("");
    setCancelled(false);
    setProgress(null);
    try {
      const res = await api.post<{ job_id: string }>("/convert/start", { pdf_path: selectedPdf });
      setJobId(res.data.job_id);
      listenToJob(res.data.job_id);
    } catch (e: any) {
      setRunning(false);
      setError(e?.response?.data?.detail || "কনভার্সন শুরু করা যায়নি");
    }
  }

  async function stopConvert() {
    if (!jobId) return;
    setStopping(true);
    try {
      await api.post(`/convert/jobs/${jobId}/stop`);
    } catch (e: any) {
      setStopping(false);
      toast.error(e?.response?.data?.detail || "থামানো যায়নি");
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

      <div className="flex gap-2 border-b pb-px">
        <button
          onClick={() => setMode("single")}
          className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${
            mode === "single" ? "bg-card font-medium" : "border-transparent text-muted-foreground hover:bg-accent"
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> একটি PDF
        </button>
        <button
          onClick={() => setMode("batch")}
          className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${
            mode === "batch" ? "bg-card font-medium" : "border-transparent text-muted-foreground hover:bg-accent"
          }`}
        >
          <FolderTree className="h-3.5 w-3.5" /> পুরো ফোল্ডার
          {(batchActive?.status === "running" || batchActive?.status === "cancelling") && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </div>

      {mode === "single" && !jobId && (
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

      {mode === "single" && jobId && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">২. প্রগ্রেস ও প্রিভিউ</h2>
            {(extractResult || error || cancelled) && (
              <Button variant="ghost" size="sm" onClick={resetAll}>
                নতুন কনভার্সন
              </Button>
            )}
          </div>

          {running && (
            <div className="mb-3 space-y-3">
              {progress && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBox label="পেজ" value={`${progress.page}/${progress.total_pages}`} />
                  <StatBox label="সেল (এই পেজে)" value={`${progress.cell}/${progress.total_cells}`} />
                  <StatBox label="ভোটার সংগৃহীত" value={progress.voters} />
                  <StatBox label="সময় চলছে" value={`${(progress.elapsed / 60).toFixed(1)} মিনিট`} />
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>পেজ ছেড়ে গেলে বা রিলোড করলেও কনভার্সন চলতেই থাকবে -- ফিরে আসলে এখানেই দেখা যাবে।</span>
              </div>
              <Button variant="outline" size="sm" onClick={stopConvert} disabled={stopping}>
                {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Octagon className="h-4 w-4" />}
                {stopping ? "থামানো হচ্ছে..." : "থামান"}
              </Button>
            </div>
          )}

          {cancelled && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <Octagon className="mt-0.5 h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                কনভার্সন আপনার অনুরোধে থামানো হয়েছে -- কোনো ডেটা ডাটাবেজে বা Excel-এ সেভ হয়নি।
              </p>
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

      {mode === "batch" && !batchActive?.batch_id && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">১. ফোল্ডার বাছাই করুন (সাবফোল্ডারসহ সব PDF কনভার্ট হবে)</h2>
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
                  onClick={() => entry.type === "dir" && setPath(entry.path)}
                  className={`flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 ${
                    entry.type === "dir" ? "cursor-pointer hover:bg-accent" : "text-muted-foreground"
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
          {browseData?.path && (
            <div className="mt-3 space-y-2 rounded-lg bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="flex-1 truncate text-xs">এই ফোল্ডার (সাবফোল্ডারসহ): {browseData.path}</span>
                <Button size="sm" onClick={startBatch} disabled={batchStarting}>
                  {batchStarting && <Loader2 className="h-4 w-4 animate-spin" />}
                  সব PDF কনভার্ট করুন
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                একে একে সব PDF কনভার্ট হয়ে সরাসরি ডাটাবেজে যোগ হয়ে যাবে (প্রিভিউ দেখানো হবে না) --
                সন্দেহজনক/অসম্পূর্ণ রেকর্ড "যাচাই প্রয়োজন" হিসেবে চিহ্নিত থাকবে, পরে ভোটার তালিকা পেজ
                থেকে যাচাই করে নিন। বড় ফোল্ডার হলে দিনের পর দিন সময় লাগতে পারে -- এই ট্যাবে ফিরে
                যেকোনো সময় অগ্রগতি দেখা যাবে।
              </p>
            </div>
          )}
        </div>
      )}

      {mode === "batch" && batchActive?.batch_id && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">২. ব্যাচ প্রগ্রেস</h2>
            {(batchActive.status === "done" || batchActive.status === "cancelled") && (
              <Button variant="ghost" size="sm" onClick={resetBatch}>নতুন ব্যাচ</Button>
            )}
          </div>
          <p className="mb-3 truncate text-xs text-muted-foreground">ফোল্ডার: {batchActive.root}</p>

          {(() => {
            const files = batchActive.files ?? [];
            const doneFiles = files.filter((f) => f.status === "done");
            const errorCount = files.filter((f) => f.status === "error").length;
            const totalVoters = doneFiles.reduce((sum, f) => sum + (f.total_voters ?? 0), 0);
            const currentEntry = batchActive.current_index != null ? files[batchActive.current_index] : undefined;
            const isLive = batchActive.status === "running" || batchActive.status === "cancelling";
            return (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBox label="মোট ফাইল" value={batchActive.total_files ?? files.length} />
                  <StatBox label="সম্পন্ন" value={doneFiles.length} />
                  <StatBox label="ব্যর্থ" value={errorCount} />
                  <StatBox label="মোট ভোটার" value={totalVoters} />
                </div>

                {isLive && (
                  <div className="mb-3 space-y-3">
                    {currentEntry && (
                      <p className="text-xs font-medium">
                        এখন প্রসেস হচ্ছে ({(batchActive.current_index ?? 0) + 1}/{batchActive.total_files}):{" "}
                        <span className="font-normal text-muted-foreground">{baseName(currentEntry.path)}</span>
                      </p>
                    )}
                    {batchActive.current_progress && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatBox label="পেজ" value={`${batchActive.current_progress.page}/${batchActive.current_progress.total_pages}`} />
                        <StatBox label="সেল" value={`${batchActive.current_progress.cell}/${batchActive.current_progress.total_cells}`} />
                        <StatBox label="এই ফাইলে ভোটার" value={batchActive.current_progress.voters} />
                        <StatBox label="সময়" value={`${(batchActive.current_progress.elapsed / 60).toFixed(1)} মিনিট`} />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      পেজ ছেড়ে গেলে, রিলোড করলে, এমনকি কয়েকদিন পর ফিরে এলেও ব্যাচ সার্ভারেই চলতে
                      থাকবে -- এই ট্যাবে ফিরলেই এখানে সর্বশেষ অবস্থা দেখা যাবে।
                    </p>
                    <Button
                      variant="outline" size="sm" onClick={stopBatch}
                      disabled={batchStopping || batchActive.status === "cancelling"}
                    >
                      {(batchStopping || batchActive.status === "cancelling") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Octagon className="h-4 w-4" />
                      )}
                      {batchActive.status === "cancelling" ? "থামানো হচ্ছে..." : "পুরো ব্যাচ থামান"}
                    </Button>
                  </div>
                )}

                {batchActive.status === "done" && (
                  <div className="mb-3 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                    <p className="text-sm">
                      ব্যাচ সম্পন্ন! {doneFiles.length}টি ফাইল সফল
                      {errorCount > 0 && `, ${errorCount}টি ব্যর্থ`} -- মোট {totalVoters} জন ভোটার ডাটাবেজে যোগ হয়েছে।
                    </p>
                  </div>
                )}
                {batchActive.status === "cancelled" && (
                  <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                    <Octagon className="mt-0.5 h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      ব্যাচ থামানো হয়েছে -- {doneFiles.length}টি ফাইল ততক্ষণে সম্পন্ন হয়ে ডাটাবেজে যোগ
                      হয়ে গেছে, বাকিগুলো এড়িয়ে যাওয়া হয়েছে।
                    </p>
                  </div>
                )}

                <div className="max-h-96 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ফাইল</TableHead>
                        <TableHead>অবস্থা</TableHead>
                        <TableHead>ভোটার</TableHead>
                        <TableHead>যাচাই প্রয়োজন</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((f) => (
                        <TableRow key={f.path} className={f.status === "error" ? "bg-destructive/5" : ""}>
                          <TableCell className="max-w-64 truncate text-xs" title={f.path}>{baseName(f.path)}</TableCell>
                          <TableCell className="text-xs">
                            {f.status === "error" ? (
                              <span className="text-destructive" title={f.error}>{BATCH_STATUS_LABEL[f.status]}</span>
                            ) : (
                              BATCH_STATUS_LABEL[f.status]
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{f.total_voters ?? "-"}</TableCell>
                          <TableCell className="text-xs">{f.flagged ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
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
