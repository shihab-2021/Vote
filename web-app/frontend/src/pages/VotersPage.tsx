import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableCell } from "@/components/EditableCell";
import { RecordDrawer } from "@/components/RecordDrawer";
import { api, type Voter, type VoterListResponse, type StatsSummary } from "@/lib/api";

const EDIT_COLS: { key: keyof Voter; label: string; width?: string }[] = [
  { key: "name", label: "নাম" },
  { key: "voter_no", label: "ভোটার নং" },
  { key: "father_name", label: "পিতার নাম" },
  { key: "mother_name", label: "মাতার নাম" },
  { key: "dob", label: "জন্ম তারিখ" },
  { key: "ward", label: "ওয়ার্ড" },
  { key: "address", label: "ঠিকানা" },
];

type DirtyMap = Record<string, Record<string, string>>; // voterId -> field -> value

export function VotersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [ward, setWard] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [detailVoter, setDetailVoter] = useState<Voter | null>(null);
  const pageSize = 50;

  const { data: wardStats } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () => api.get<StatsSummary>("/stats/summary").then((r) => r.data),
    staleTime: 60_000,
  });
  const wardOptions = useMemo(
    () => Object.keys(wardStats?.by_ward ?? {}).sort(),
    [wardStats]
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["voters", { search, ward, flaggedOnly, page }],
    queryFn: () =>
      api
        .get<VoterListResponse>("/voters", {
          params: {
            search: search || undefined,
            ward: ward || undefined,
            flagged: flaggedOnly ? true : undefined,
            page,
            page_size: pageSize,
          },
        })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(dirty);
      await Promise.all(
        entries.map(([voterId, fields]) => api.patch(`/voters/${voterId}`, fields))
      );
    },
    onSuccess: () => {
      toast.success(`${Object.keys(dirty).length}টি ভোটারের পরিবর্তন সংরক্ষিত হয়েছে`);
      setDirty({});
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      queryClient.invalidateQueries({ queryKey: ["stats-summary"] });
    },
    onError: () => toast.error("সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  function setCell(voterId: number, field: string, value: string) {
    setDirty((d) => ({
      ...d,
      [voterId]: { ...d[voterId], [field]: value },
    }));
  }

  function cellValue(voter: Voter, field: keyof Voter): string {
    const override = dirty[voter.id]?.[field as string];
    return override ?? ((voter[field] as string) || "");
  }

  async function exportData(format: "xlsx" | "csv") {
    const res = await api.get("/export", {
      params: {
        format,
        search: search || undefined,
        ward: ward || undefined,
        flagged: flaggedOnly ? true : undefined,
      },
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voters_export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">ভোটার তালিকা</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `মোট ${data.total.toLocaleString("bn-BD")} জন` : "লোড হচ্ছে..."}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Download className="h-4 w-4" /> এক্সপোর্ট
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportData("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData("csv")}>CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="নাম, ভোটার নং, পিতা, মাতা, ঠিকানা দিয়ে খুঁজুন..."
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={ward || "__all__"}
          onValueChange={(v) => {
            setWard(!v || v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="সব ওয়ার্ড" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">সব ওয়ার্ড</SelectItem>
            {wardOptions.map((w) => (
              <SelectItem key={w} value={w}>
                ওয়ার্ড {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={flaggedOnly}
            onCheckedChange={(v) => {
              setFlaggedOnly(!!v);
              setPage(1);
            }}
          />
          শুধু যাচাই প্রয়োজন
        </label>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {EDIT_COLS.map((c) => (
                <TableHead key={c.key as string}>{c.label}</TableHead>
              ))}
              <TableHead className="text-right">বিস্তারিত</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {EDIT_COLS.map((c) => (
                    <TableCell key={c.key as string}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              ))}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={EDIT_COLS.length + 1} className="py-10 text-center text-muted-foreground">
                  কোনো ফলাফল নেই
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((voter) => (
              <TableRow key={voter.id} className={voter.is_flagged ? "bg-destructive/5" : ""}>
                {EDIT_COLS.map((c) => (
                  <TableCell key={c.key as string} className="p-1">
                    <EditableCell
                      value={cellValue(voter, c.key)}
                      dirty={!!dirty[voter.id]?.[c.key as string]}
                      onCommit={(v) => setCell(voter.id, c.key as string, v)}
                    />
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setDetailVoter(voter)}>
                    দেখুন
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          পৃষ্ঠা {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {dirtyCount > 0 && (
        <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm text-muted-foreground">{dirtyCount}টি ভোটারে পরিবর্তন</span>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            সেভ করুন
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDirty({})}>
            বাতিল
          </Button>
        </div>
      )}

      <RecordDrawer voter={detailVoter} onClose={() => setDetailVoter(null)} />
    </div>
  );
}
