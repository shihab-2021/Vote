import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Search, Download, ChevronLeft, ChevronRight, Loader2, X, Plus, MapPin,
  SlidersHorizontal, Users2, IdCard, Printer,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EditableCell } from "@/components/EditableCell";
import { RecordDrawer } from "@/components/RecordDrawer";
import { cn } from "@/lib/utils";
import {
  api, VOTER_LABELS, type Voter, type VoterListResponse, type StatsSummary, type FieldDef,
} from "@/lib/api";

// "Find By" ফিল্ড তালিকা থেকে যেগুলোর নিজস্ব দ্রুত-ফিল্টার ইতিমধ্যে আলাদাভাবে আছে (ওয়ার্ড ড্রপডাউন,
// ঠিকানা অটোকমপ্লিট) সেগুলো এখানে বাদ দেওয়া হয়, যাতে একই ফিল্টার দুই জায়গায় ডুপ্লিকেট না হয়
const FIND_BY_EXCLUDE = new Set(["ward", "address"]);

interface FindByRow {
  field: string;
  value: string;
}

interface FindByFieldOption {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
}

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [ward, setWard] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [detailVoter, setDetailVoter] = useState<Voter | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const pageSize = 50;

  // ঠিকানা অটোকমপ্লিট -- একটা বিদ্যমান ঠিকানা বেছে নিলে সেটা `address`-এ (হুবহু মিল) সেভ হয়
  const [address, setAddress] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);

  // "Find By" -- ফিল্ড বাছাই করে যেকোনো কোর/কাস্টম ফিল্ড দিয়ে ফিল্টার যোগ করা যায় (AND মিলিয়ে)
  const [findByRows, setFindByRows] = useState<FindByRow[]>([]);

  const { data: wardStats } = useQuery({
    queryKey: ["stats-summary"],
    queryFn: () => api.get<StatsSummary>("/stats/summary").then((r) => r.data),
    staleTime: 60_000,
  });
  const wardOptions = useMemo(
    () => Object.keys(wardStats?.by_ward ?? {}).sort(),
    [wardStats]
  );
  const genderOptions = useMemo(
    () => Object.keys(wardStats?.by_gender ?? {}).sort(),
    [wardStats]
  );

  const { data: fieldDefs } = useQuery({
    queryKey: ["field-defs"],
    queryFn: () => api.get<FieldDef[]>("/field-defs").then((r) => r.data),
    staleTime: 60_000,
  });
  const findByFieldOptions: FindByFieldOption[] = useMemo(() => {
    const core = Object.entries(VOTER_LABELS)
      .filter(([key]) => !FIND_BY_EXCLUDE.has(key))
      .map(([key, label]) => ({ key, label, type: "text" as const, options: null }));
    const custom = (fieldDefs ?? []).map((f) => ({
      key: f.key, label: f.label, type: f.field_type, options: f.options,
    }));
    return [...core, ...custom];
  }, [fieldDefs]);

  const { data: addressSuggestions } = useQuery({
    queryKey: ["voter-addresses", addressInput],
    queryFn: () => api.get<string[]>("/voters/addresses", {
      params: { q: addressInput || undefined, limit: 15 },
    }).then((r) => r.data),
    enabled: addressOpen,
    staleTime: 30_000,
  });

  function addFindByRow() {
    setFindByRows((rows) => [...rows, { field: "", value: "" }]);
  }
  function updateFindByRow(idx: number, patch: Partial<FindByRow>) {
    setFindByRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setPage(1);
  }
  function removeFindByRow(idx: number) {
    setFindByRows((rows) => rows.filter((_, i) => i !== idx));
    setPage(1);
  }
  function clearAddress() {
    setAddress("");
    setAddressInput("");
    setPage(1);
  }
  function clearAllFilters() {
    setSearch("");
    setWard("");
    setFlaggedOnly(false);
    clearAddress();
    setFindByRows([]);
  }

  const filtersPayload = useMemo(() => {
    const rows = findByRows.filter((r) => r.field && r.value);
    const combined = address ? [{ field: "address", value: address }, ...rows] : rows;
    return combined.length ? JSON.stringify(combined) : undefined;
  }, [address, findByRows]);

  // সক্রিয় ফিল্টার -- চিপ হিসেবে দেখানো হয়, প্রতিটা আলাদাভাবে সরানো যায় (সার্চ বক্স বাদে, সেটা
  // নিজেই সবসময় দৃশ্যমান থাকে বলে আলাদা চিপের দরকার নেই)
  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (ward) chips.push({ key: "ward", label: `ওয়ার্ড ${ward}`, onRemove: () => { setWard(""); setPage(1); } });
    if (flaggedOnly) chips.push({ key: "flagged", label: "যাচাই প্রয়োজন", onRemove: () => { setFlaggedOnly(false); setPage(1); } });
    if (address) chips.push({ key: "address", label: address, onRemove: clearAddress });
    findByRows.forEach((r, idx) => {
      if (!r.field || !r.value) return;
      const fieldLabel = findByFieldOptions.find((f) => f.key === r.field)?.label ?? r.field;
      chips.push({ key: `findby-${idx}`, label: `${fieldLabel}: ${r.value}`, onRemove: () => removeFindByRow(idx) });
    });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ward, flaggedOnly, address, findByRows, findByFieldOptions]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["voters", { search, ward, flaggedOnly, page, filtersPayload }],
    queryFn: () =>
      api
        .get<VoterListResponse>("/voters", {
          params: {
            search: search || undefined,
            ward: ward || undefined,
            flagged: flaggedOnly ? true : undefined,
            filters: filtersPayload,
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
        filters: filtersPayload,
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

  async function createPrintBatch() {
    setCreatingBatch(true);
    try {
      const res = await api.post<{ id: number; voter_count: number }>("/print-batches", null, {
        params: {
          search: search || undefined,
          ward: ward || undefined,
          flagged: flaggedOnly ? true : undefined,
          filters: filtersPayload,
        },
      });
      toast.success(`${res.data.voter_count} জনের প্রিন্ট ব্যাচ তৈরি হয়েছে`);
      navigate(`/print/${res.data.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "প্রিন্ট ব্যাচ তৈরি করা যায়নি");
    } finally {
      setCreatingBatch(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const dirtyCount = Object.keys(dirty).length;

  function renderSearchField(className?: string) {
    return (
      <div className={cn("relative min-w-[240px] flex-1", className)}>
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="নাম, ভোটার নং, পিতা, মাতা, ঠিকানা দিয়ে খুঁজুন..."
          className="pl-8 pr-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {search && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  function renderWardAndFlagged() {
    return (
      <>
        <Select
          value={ward || "__all__"}
          onValueChange={(v) => {
            setWard(!v || v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="সব ওয়ার্ড">
              {(v: string | null) => (!v || v === "__all__" ? "সব ওয়ার্ড" : `ওয়ার্ড ${v}`)}
            </SelectValue>
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
        <label className="flex items-center gap-2 py-1 text-sm">
          <Checkbox
            checked={flaggedOnly}
            onCheckedChange={(v) => {
              setFlaggedOnly(!!v);
              setPage(1);
            }}
          />
          শুধু যাচাই প্রয়োজন
        </label>
      </>
    );
  }

  function renderAddressField() {
    return (
      <div className="relative min-w-[260px] flex-1">
        <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ঠিকানা/বাড়ি দিয়ে খুঁজুন..."
          className="pl-8 pr-8"
          value={address || addressInput}
          onFocus={() => setAddressOpen(true)}
          onBlur={() => setTimeout(() => setAddressOpen(false), 150)}
          onChange={(e) => {
            setAddress("");
            setAddressInput(e.target.value);
            setAddressOpen(true);
            setPage(1);
          }}
        />
        {address && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearAddress}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {addressOpen && !address && (addressSuggestions?.length ?? 0) > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-lg border bg-card shadow-lg">
            {addressSuggestions!.map((a) => (
              <div
                key={a}
                className="cursor-pointer px-3 py-2 text-xs hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAddress(a);
                  setAddressInput("");
                  setAddressOpen(false);
                  setPage(1);
                }}
              >
                {a}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderFindByBuilder() {
    return (
      <div className="flex flex-1 flex-col gap-2">
        <Button variant="outline" size="sm" onClick={addFindByRow} className="self-start">
          <Plus className="h-3.5 w-3.5" /> Find By ফিল্টার যোগ করুন
        </Button>
        {findByRows.map((row, idx) => {
          const fieldDef = findByFieldOptions.find((f) => f.key === row.field);
          const isGender = row.field === "gender";
          const selectOptions = isGender ? genderOptions : fieldDef?.type === "select" ? fieldDef.options ?? [] : null;
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <Select
                value={row.field || "__none__"}
                onValueChange={(v) => updateFindByRow(idx, { field: !v || v === "__none__" ? "" : v, value: "" })}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="ফিল্ড বাছাই করুন">
                    {(v: string | null) => findByFieldOptions.find((f) => f.key === v)?.label ?? "ফিল্ড বাছাই করুন"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ফিল্ড বাছাই করুন</SelectItem>
                  {findByFieldOptions.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectOptions ? (
                <Select value={row.value || "__none__"} onValueChange={(v) => updateFindByRow(idx, { value: !v || v === "__none__" ? "" : v })}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="মান বাছাই করুন">
                      {(v: string | null) => (!v || v === "__none__" ? "মান বাছাই করুন" : v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">মান বাছাই করুন</SelectItem>
                    {selectOptions.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="w-[160px]"
                  placeholder="মান লিখুন..."
                  value={row.value}
                  disabled={!row.field}
                  onChange={(e) => updateFindByRow(idx, { value: e.target.value })}
                />
              )}

              <Button variant="ghost" size="icon" aria-label="এই ফিল্টার মুছুন" onClick={() => removeFindByRow(idx)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">ভোটার তালিকা</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `মোট ${data.total.toLocaleString("bn-BD")} জন` : "লোড হচ্ছে..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.permissions.includes("generate_voter_card") && (
            <Button variant="outline" size="sm" onClick={createPrintBatch} disabled={creatingBatch}>
              {creatingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              <span className="hidden sm:inline">প্রিন্ট ব্যাচ তৈরি করুন</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">এক্সপোর্ট</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportData("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData("csv")}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* মোবাইল -- সবসময় দৃশ্যমান সার্চ + একটা "ফিল্টার" বাটনে বাকি সব (বটম শিট) */}
      <div className="flex items-center gap-2 md:hidden">
        {renderSearchField()}
        <Button variant="outline" size="default" className="relative shrink-0" onClick={() => setFilterSheetOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          ফিল্টার
          {activeFilterChips.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {activeFilterChips.length}
            </span>
          )}
        </Button>
        {isFetching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle>ফিল্টার করুন</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">ঠিকানা/বাড়ি</p>
              {renderAddressField()}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {renderWardAndFlagged()}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Find By</p>
              {renderFindByBuilder()}
            </div>
          </div>
          <SheetFooter className="flex-row gap-2">
            {activeFilterChips.length > 0 && (
              <Button variant="outline" className="flex-1" onClick={clearAllFilters}>
                সব মুছুন
              </Button>
            )}
            <Button className="flex-1" onClick={() => setFilterSheetOpen(false)}>
              ফলাফল দেখুন
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ডেস্কটপ -- সব ফিল্টার সরাসরি দৃশ্যমান (আগের মতোই) */}
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        {renderSearchField()}
        {renderWardAndFlagged()}
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="hidden flex-wrap items-start gap-3 md:flex">
        {renderAddressField()}
        {renderFindByBuilder()}
      </div>

      {/* সক্রিয় ফিল্টার চিপ -- সব ব্রেকপয়েন্টেই দৃশ্যমান */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="flex max-w-full items-center gap-1 rounded-full bg-accent py-1 pl-2.5 pr-1.5 text-xs text-accent-foreground"
            >
              <span className="line-clamp-1">{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-1.5 py-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            সব মুছুন
          </button>
        </div>
      )}

      {/* লোডিং -- মোবাইল কার্ড স্কেলিটন + ডেস্কটপ টেবিল স্কেলিটন */}
      {isLoading && (
        <>
          <div className="space-y-2 md:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="hidden overflow-auto rounded-lg border md:block">
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {EDIT_COLS.map((c) => (
                      <TableCell key={c.key as string}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* খালি ফলাফল -- একটাই শেয়ার্ড স্টেট, সব ব্রেকপয়েন্টে */}
      {!isLoading && data?.items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Users2 className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">কোনো ফলাফল নেই</p>
          <p className="text-sm text-muted-foreground">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
          {activeFilterChips.length > 0 && (
            <Button variant="outline" size="sm" className="mt-2" onClick={clearAllFilters}>
              সব ফিল্টার মুছুন
            </Button>
          )}
        </div>
      )}

      {/* মোবাইল -- কার্ড লিস্ট; ট্যাপ করলে RecordDrawer-এ পূর্ণ বিস্তারিত/এডিট */}
      {!isLoading && !!data?.items.length && (
        <div className="space-y-2 md:hidden">
          {data.items.map((voter) => (
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
      )}

      {/* ডেস্কটপ -- বিদ্যমান ইনলাইন-এডিটেবল টেবিল, অপরিবর্তিত */}
      {!isLoading && !!data?.items.length && (
        <div className="hidden overflow-auto rounded-lg border md:block">
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
              {data.items.map((voter) => (
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
      )}

      {!!data?.items.length && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            পৃষ্ঠা {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8" aria-label="আগের পৃষ্ঠা"
              disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8" aria-label="পরের পৃষ্ঠা"
              disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {dirtyCount > 0 && (
        <div className="fixed bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg md:bottom-4">
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
