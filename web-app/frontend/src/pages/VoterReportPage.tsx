import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
  Users,
  MapPin,
  SlidersHorizontal,
  Building2,
  Landmark,
  Layers,
  Hash,
} from "lucide-react";
import { api, type LocationOptionsResponse, type VoterReportResponse } from "@/lib/api";
import { Masthead } from "@/components/motifs/Masthead";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function toBengaliNumber(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val);
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return s.replace(/\d/g, (d) => bnDigits[Number(d)]);
}

export function VoterReportPage() {
  // ক্যাসকেডিং ফিল্টার স্টেট -- নির্বাচন না করা থাকলে বা সকল এর জন্য "__all__"
  const [district, setDistrict] = useState("__all__");
  const [municipality, setMunicipality] = useState("__all__");
  const [upazila, setUpazila] = useState("__all__");
  const [unionName, setUnionName] = useState("__all__");
  const [ward, setWard] = useState("__all__");

  // সক্রিয় কুয়েরি প্যারামিটার -- "রিপোর্ট দেখুন" বাটনে ক্লিক করলে বা প্রাথমিক লোডে আপডেট হয়
  const [appliedFilters, setAppliedFilters] = useState<{
    district: string;
    municipality: string;
    upazila: string;
    unionName: string;
    ward: string;
  }>({
    district: "",
    municipality: "",
    upazila: "",
    unionName: "",
    ward: "",
  });

  // ক্যাসকেডিং লোকেশন অপশনস কোয়েরি
  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: [
      "report-locations",
      district === "__all__" ? "" : district,
      municipality === "__all__" ? "" : municipality,
      upazila === "__all__" ? "" : upazila,
      unionName === "__all__" ? "" : unionName,
    ],
    queryFn: () =>
      api
        .get<LocationOptionsResponse>("/reports/locations", {
          params: {
            district: district === "__all__" ? undefined : district,
            municipality: municipality === "__all__" ? undefined : municipality,
            upazila: upazila === "__all__" ? undefined : upazila,
            union_name: unionName === "__all__" ? undefined : unionName,
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  // ভোটার রিপোর্ট ডেটা কুয়েরি
  const {
    data: report,
    isLoading: loadingReport,
    isFetching: fetchingReport,
    error: reportError,
    refetch,
  } = useQuery({
    queryKey: [
      "voter-report",
      appliedFilters.district,
      appliedFilters.municipality,
      appliedFilters.upazila,
      appliedFilters.unionName,
      appliedFilters.ward,
    ],
    queryFn: () =>
      api
        .get<VoterReportResponse>("/reports/voters", {
          params: {
            district: appliedFilters.district || undefined,
            municipality: appliedFilters.municipality || undefined,
            upazila: appliedFilters.upazila || undefined,
            union_name: appliedFilters.unionName || undefined,
            ward: appliedFilters.ward && appliedFilters.ward !== "__all__" ? appliedFilters.ward : undefined,
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  // প্যারেন্ট ড্রপডাউন পরিবর্তন ও নির্ভরতা রিসেট হ্যান্ডলারসমূহ
  function handleDistrictChange(val: string | null) {
    const v = val || "__all__";
    setDistrict(v);
    setMunicipality("__all__");
    setUpazila("__all__");
    setUnionName("__all__");
    setWard("__all__");
  }

  function handleMunicipalityChange(val: string | null) {
    const v = val || "__all__";
    setMunicipality(v);
    setUpazila("__all__");
    setUnionName("__all__");
    setWard("__all__");
  }

  function handleUpazilaChange(val: string | null) {
    const v = val || "__all__";
    setUpazila(v);
    setUnionName("__all__");
    setWard("__all__");
  }

  function handleUnionChange(val: string | null) {
    const v = val || "__all__";
    setUnionName(v);
    setWard("__all__");
  }

  function handleWardChange(val: string | null) {
    setWard(val || "__all__");
  }

  function handleResetFilters() {
    setDistrict("__all__");
    setMunicipality("__all__");
    setUpazila("__all__");
    setUnionName("__all__");
    setWard("__all__");
    setAppliedFilters({
      district: "",
      municipality: "",
      upazila: "",
      unionName: "",
      ward: "",
    });
  }

  function handleGenerateReport() {
    setAppliedFilters({
      district: district === "__all__" ? "" : district,
      municipality: municipality === "__all__" ? "" : municipality,
      upazila: upazila === "__all__" ? "" : upazila,
      unionName: unionName === "__all__" ? "" : unionName,
      ward: ward === "__all__" ? "" : ward,
    });
  }

  const today = new Date().toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalHouseCount = report?.wards.reduce(
    (acc, w) => acc + w.addresses.length,
    0
  ) || 0;

  return (
    <div className="space-y-6">
      {/* পেজ হেডার / মাস্টহেড -- প্রিন্টের সময় লুকানো */}
      <Masthead
        className="no-print"
        eyebrow="ভোটার তথ্য ও সহায়তা প্ল্যাটফর্ম — প্রশাসনিক এলাকাভিত্তিক খতিয়ান"
        title="ভোটার রিপোর্ট"
        subtitle="জেলা, পৌরসভা, উপজেলা, ইউনিয়ন ও ওয়ার্ডভিত্তিক ভোটার পরিসংখ্যান ও ঠিকানার সম্পূর্ণ বিবরণী"
        actions={
          <Button
            onClick={() => window.print()}
            disabled={!report || loadingReport}
            className="stamp-press gap-2 border-kraft bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" />
            <span>প্রিন্ট রিপোর্ট</span>
          </Button>
        }
      />

      {/* ক্যাসকেডিং ফিল্টার কার্ড -- প্রিন্টের সময় লুকানো */}
      <div className="no-print rounded-lg border border-kraft bg-card p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-kraft/30 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-base font-semibold">প্রশাসনিক এলাকা ফিল্টার</h2>
            <Badge variant="outline" className="border-dashed text-xs text-muted-foreground">
              ক্যাসকেডিং ড্রপডাউন
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            সব ফিল্টার বাধ্যতামূলক নয়; আপনার পছন্দমতো স্তরে ফিল্টার করুন
          </span>
        </div>

        {/* ৫টি ক্যাসকেডিং ড্রপডাউন গ্রিড */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* ১. জেলা */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> জেলা
            </label>
            <Select value={district} onValueChange={handleDistrictChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {(v: string | null) => (!v || v === "__all__" ? "সকল জেলা" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">সকল জেলা</SelectItem>
                {locations?.districts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ২. পৌরসভা */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" /> পৌরসভা
            </label>
            <Select value={municipality} onValueChange={handleMunicipalityChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {(v: string | null) => (!v || v === "__all__" ? "সকল পৌরসভা" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">সকল পৌরসভা</SelectItem>
                {locations?.municipalities.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ৩. উপজেলা */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Landmark className="h-3.5 w-3.5 text-primary" /> উপজেলা
            </label>
            <Select value={upazila} onValueChange={handleUpazilaChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {(v: string | null) => (!v || v === "__all__" ? "সকল উপজেলা" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">সকল উপজেলা</SelectItem>
                {locations?.upazilas.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ৪. ইউনিয়ন/ওয়ার্ড */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" /> ইউনিয়ন/ওয়ার্ড
            </label>
            <Select value={unionName} onValueChange={handleUnionChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {(v: string | null) => (!v || v === "__all__" ? "সকল ইউনিয়ন/ওয়ার্ড" : v)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">সকল ইউনিয়ন/ওয়ার্ড</SelectItem>
                {locations?.unions.map((un) => (
                  <SelectItem key={un} value={un}>
                    {un}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ৫. ওয়ার্ড নং -- ডিফল্ট "সকল" */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Hash className="h-3.5 w-3.5 text-primary" /> ওয়ার্ড নং
            </label>
            <Select value={ward} onValueChange={handleWardChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === "__all__" ? "সকল ওয়ার্ড" : `ওয়ার্ড নং ${toBengaliNumber(v)}`
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">সকল ওয়ার্ড</SelectItem>
                {locations?.wards.map((w) => (
                  <SelectItem key={w} value={w}>
                    ওয়ার্ড নং {toBengaliNumber(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ফিল্টার অ্যাকশন বাটনসমূহ */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-kraft/30 pt-3">
          <div className="text-xs text-muted-foreground">
            {loadingLocations ? (
              <span>অপশন লোড হচ্ছে...</span>
            ) : (
              <span>
                উপলব্ধ: {locations?.districts.length || 0} টি জেলা,{" "}
                {locations?.upazilas.length || 0} টি উপজেলা,{" "}
                {locations?.wards.length || 0} টি ওয়ার্ড
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1.5 border-kraft text-muted-foreground hover:bg-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ফিল্টার রিসেট</span>
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateReport}
              disabled={loadingReport || fetchingReport}
              className="stamp-press gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{loadingReport || fetchingReport ? "রিপোর্ট তৈরি হচ্ছে..." : "রিপোর্ট দেখুন"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* লোডিং অবস্থা */}
      {loadingReport && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </div>
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      )}

      {/* ত্রুটি অবস্থা */}
      {reportError && !loadingReport && (
        <div className="rounded-lg border border-destructive/40 bg-card p-6 text-center">
          <p className="font-semibold text-destructive">রিপোর্ট লোড করতে সমস্যা হয়েছে</p>
          <p className="mt-1 text-sm text-muted-foreground">
            সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            আবার চেষ্টা করুন
          </Button>
        </div>
      )}

      {/* রিপোর্ট আউটপুট কনটেইনার -- স্ক্রিনেও সুন্দর এবং প্রিন্টেও পরিচ্ছন্ন */}
      {!loadingReport && report && (
        <div id="voter-report-printable-area" className="space-y-6">
          {/* ১. নির্বাচিত প্রশাসনিক এলাকা ও সারসংক্ষেপ হেডিং -- প্রিন্ট ও স্ক্রিন উভয় জায়গায় দৃশ্যমান */}
          <div className="rounded-lg border border-kraft bg-card p-5 shadow-xs">
            {/* প্রিন্ট হেডার ব্যানার (শুধু প্রিন্টে দৃশ্যমান আনুষ্ঠানিক শিরোনাম) */}
            <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
              <h1 className="text-xl font-bold font-heading">গণপ্রজাতন্ত্রী বাংলাদেশ — ভোটার তালিকা প্রতিবেদন</h1>
              <p className="text-xs text-muted-foreground mt-0.5">ওয়ার্ড ও ঠিকানাভিত্তিক ভোটার খতিয়ান</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kraft/30 pb-3">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  নির্বাচিত প্রশাসনিক এলাকা
                </span>
                <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
                  {report.area_heading}
                </h2>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>রিপোর্ট তৈরির তারিখ: <span className="font-semibold text-foreground">{today}</span></p>
                <p className="mt-0.5">
                  মোট ওয়ার্ড: <span className="font-semibold text-foreground">{report.wards.length.toLocaleString("bn-BD")}</span> টি
                </p>
              </div>
            </div>

            {/* নির্বাচিত এলাকার সারসংক্ষেপ (পুরুষ ভোটার, মহিলা ভোটার, মোট ভোটার) */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* পুরুষ ভোটার */}
              <div className="rounded border border-kraft/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">পুরুষ ভোটার</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {report.summary.total_voters > 0
                      ? `${((report.summary.total_male / report.summary.total_voters) * 100).toFixed(1)}%`
                      : "০%"}
                  </Badge>
                </div>
                <div className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                  {report.summary.total_male.toLocaleString("bn-BD")}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">জন</span>
                </div>
              </div>

              {/* মহিলা ভোটার */}
              <div className="rounded border border-kraft/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">মহিলা ভোটার</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {report.summary.total_voters > 0
                      ? `${((report.summary.total_female / report.summary.total_voters) * 100).toFixed(1)}%`
                      : "০%"}
                  </Badge>
                </div>
                <div className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                  {report.summary.total_female.toLocaleString("bn-BD")}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">জন</span>
                </div>
              </div>

              {/* মোট ভোটার */}
              <div className="rounded border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">মোট ভোটার</span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                    <Users className="h-3 w-3" /> সর্বমোট
                  </span>
                </div>
                <div className="mt-1 font-heading text-2xl font-bold tabular-nums text-primary sm:text-3xl">
                  {report.summary.total_voters.toLocaleString("bn-BD")}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">জন</span>
                </div>
              </div>
            </div>
          </div>

          {/* যদি কোনো ওয়ার্ড বা রেকর্ড না থাকে */}
          {report.wards.length === 0 && (
            <WarmEmptyState
              icon={FileSpreadsheet}
              title="কোনো ভোটার রেকর্ড পাওয়া যায়নি"
              subtitle="নির্বাচিত ফিল্টারের শর্ত অনুযায়ী কোনো ভোটার রেকর্ড মেলেনি। অন্য এলাকা নির্বাচন করে দেখুন।"
            >
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2">
                ফিল্টার রিসেট করুন
              </Button>
            </WarmEmptyState>
          )}

          {/* ২. ওয়ার্ড ভিত্তিক পৃথক টেবিলসমূহ */}
          {report.wards.map((w) => (
            <div
              key={w.ward}
              className="print-avoid-break rounded-lg border border-kraft bg-card shadow-xs overflow-hidden"
            >
              {/* ওয়ার্ড হেডার বার */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kraft bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {toBengaliNumber(w.ward)}
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground">
                      ওয়ার্ড নং: {toBengaliNumber(w.ward)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      মোট ঠিকানা/বাড়ি: {w.addresses.length.toLocaleString("bn-BD")} টি
                    </p>
                  </div>
                </div>

                {/* ওয়ার্ড উপমোট ব্যাজসমূহ */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-kraft bg-background">
                    পুরুষ: <strong className="ml-1 tabular-nums">{w.male_subtotal.toLocaleString("bn-BD")}</strong>
                  </Badge>
                  <Badge variant="outline" className="border-kraft bg-background">
                    মহিলা: <strong className="ml-1 tabular-nums">{w.female_subtotal.toLocaleString("bn-BD")}</strong>
                  </Badge>
                  <Badge className="bg-primary text-primary-foreground">
                    মোট: <strong className="ml-1 tabular-nums">{w.total_subtotal.toLocaleString("bn-BD")}</strong>
                  </Badge>
                </div>
              </div>

              {/* ওয়ার্ডের ঠিকানাভিত্তিক ভোটার টেবিল */}
              <div className="overflow-x-auto">
                <Table className="printable-table w-full text-sm">
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-b border-kraft/40 hover:bg-transparent">
                      <TableHead className="w-[50%] min-w-[220px] font-semibold text-foreground">
                        ঠিকানা/বাড়ি
                      </TableHead>
                      <TableHead className="w-[16%] text-right font-semibold text-foreground">
                        পুরুষ ভোটার
                      </TableHead>
                      <TableHead className="w-[16%] text-right font-semibold text-foreground">
                        মহিলা ভোটার
                      </TableHead>
                      <TableHead className="w-[18%] text-right font-semibold text-foreground">
                        মোট ভোটার
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {w.addresses.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className="border-b border-kraft/20 hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="py-2.5">
                          {row.address ? (
                            <span className="font-medium text-foreground">{row.address}</span>
                          ) : (
                            <span className="italic text-muted-foreground">(ঠিকানা উল্লেখ নেই)</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums text-foreground">
                          {row.male_count.toLocaleString("bn-BD")}
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums text-foreground">
                          {row.female_count.toLocaleString("bn-BD")}
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums font-semibold text-foreground">
                          {row.total_count.toLocaleString("bn-BD")}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* ওয়ার্ড উপমোট সারি (Subtotal Row) */}
                    <TableRow className="subtotal-row border-t-2 border-kraft bg-muted/60 font-bold hover:bg-muted/70">
                      <TableCell className="py-3 text-foreground font-semibold">
                        ওয়ার্ড নং {toBengaliNumber(w.ward)} উপমোট ({w.addresses.length.toLocaleString("bn-BD")} টি বাড়ি)
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-foreground font-bold">
                        {w.male_subtotal.toLocaleString("bn-BD")}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-foreground font-bold">
                        {w.female_subtotal.toLocaleString("bn-BD")}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-primary font-bold">
                        {w.total_subtotal.toLocaleString("bn-BD")}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}

          {/* ৩. সকল অন্তর্ভুক্ত ওয়ার্ডের সর্বমোট ভোটার (Grand Totals) */}
          {report.wards.length > 0 && (
            <div className="print-avoid-break rounded-lg border-2 border-primary/60 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kraft/40 pb-3">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                    চূড়ান্ত পরিসংখ্যান
                  </span>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    সকল অন্তর্ভুক্ত ওয়ার্ডের সর্বমোট ভোটার (গ্র্যান্ড টোটাল)
                  </h3>
                </div>
                <div className="text-xs text-muted-foreground">
                  মোট ওয়ার্ড: <strong>{report.wards.length.toLocaleString("bn-BD")}</strong> টি | মোট বাড়ি/ঠিকানা:{" "}
                  <strong>{totalHouseCount.toLocaleString("bn-BD")}</strong> টি
                </div>
              </div>

              {/* গ্র্যান্ড টোটাল সারাংশ টেবিল */}
              <div className="mt-4 overflow-x-auto">
                <Table className="printable-table w-full text-sm">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-kraft">
                      <TableHead className="font-semibold text-foreground">বিবরণ</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">পুরুষ ভোটার</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">মহিলা ভোটার</TableHead>
                      <TableHead className="text-right font-semibold text-primary font-bold">সর্বমোট ভোটার</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="subtotal-row bg-primary/5 text-base font-bold">
                      <TableCell className="py-3 font-semibold text-foreground">
                        সর্বমোট ({report.wards.length.toLocaleString("bn-BD")} টি ওয়ার্ড)
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-foreground">
                        {report.grand_total.total_male.toLocaleString("bn-BD")}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-foreground">
                        {report.grand_total.total_female.toLocaleString("bn-BD")}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-primary font-bold">
                        {report.grand_total.total_voters.toLocaleString("bn-BD")} জন
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* প্রিন্ট ফুটনোট -- শুধু প্রিন্টে দৃশ্যমান */}
              <div className="hidden print:flex justify-between items-center text-[10px] text-muted-foreground mt-6 pt-3 border-t border-gray-300">
                <span>ভোটার রেজিস্ট্রি ব্যবস্থাপনা সিস্টেম থেকে সংগৃহীত</span>
                <span>প্রিন্টের সময়: {new Date().toLocaleString("bn-BD")}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
