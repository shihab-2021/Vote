import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { api, type FieldDef, type Voter, VOTER_LABELS } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface RecordDrawerProps {
  voter: Voter | null;
  onClose: () => void;
}

const CORE_KEYS = Object.keys(VOTER_LABELS) as (keyof typeof VOTER_LABELS)[];

export function RecordDrawer({ voter, onClose }: RecordDrawerProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  // manage_data না থাকলে (যেমন field_search/print_distribution রোল) এডিট করার অনুমতি নেই --
  // ব্যাকএন্ডও require_permission("manage_data") দিয়ে একই জিনিস প্রয়োগ করে, এটা শুধু UX-এর জন্য
  const canEdit = !!user?.permissions.includes("manage_data");
  const [form, setForm] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, string>>({});

  const { data: fieldDefs = [] } = useQuery({
    queryKey: ["field-defs"],
    queryFn: () => api.get<FieldDef[]>("/field-defs").then((r) => r.data),
  });

  useEffect(() => {
    if (!voter) return;
    const core: Record<string, string> = {};
    for (const k of CORE_KEYS) core[k] = (voter[k as keyof Voter] as string) ?? "";
    setForm(core);
    setExtra({ ...voter.extra_fields });
  }, [voter]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/voters/${voter!.id}`, { ...form, extra_fields: extra }),
    onSuccess: () => {
      toast.success("সংরক্ষিত হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["voters"] });
      onClose();
    },
    onError: () => toast.error("সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  return (
    <Sheet open={!!voter} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-y-auto",
          isMobile ? "max-h-[92vh] w-full rounded-t-2xl" : "w-full sm:max-w-lg"
        )}
      >
        {voter && (
          <>
            {/* voter-id-card স্টাইল হেডার -- সবুজ ব্যান্ড, অ্যাভাটার, কোণে যাচাই-প্রয়োজন সিল */}
            <div className="relative mx-4 mt-4 shrink-0 overflow-hidden rounded-xl border border-kraft bg-card shadow-sm">
              <div className="flex items-center gap-2 bg-primary px-4 py-2.5">
                <span className="text-[11px] font-bold tracking-wide text-primary-foreground">ভোটার পরিচয় কার্ড</span>
              </div>
              <div className="flex gap-3.5 p-4">
                <div className="flex h-16 w-13 shrink-0 items-center justify-center rounded border border-dashed border-kraft bg-secondary">
                  <User className="h-7 w-7 text-kraft" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="font-heading truncate text-base font-bold">{voter.name}</SheetTitle>
                  <SheetDescription className="tabular-nums">ভোটার নং: {voter.voter_no || "—"}</SheetDescription>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[voter.ward && `ওয়ার্ড ${voter.ward}`, voter.upazila, voter.district].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
              {voter.is_flagged && (
                <div className="absolute top-10 right-3 flex h-11 w-11 rotate-[-10deg] items-center justify-center rounded-full bg-stamp opacity-90 shadow">
                  <div className="absolute inset-1 rounded-full border border-dashed border-primary-foreground/50" />
                  <span className="text-center text-[7px] leading-none font-bold text-primary-foreground">
                    যাচাই<br />প্রয়োজন
                  </span>
                </div>
              )}
              {voter.is_flagged && (
                <div className="flex flex-wrap gap-1 border-t border-dashed border-kraft px-4 py-2">
                  {voter.flag_reasons.map((r) => (
                    <Badge key={r} variant="destructive" className="text-[10px] font-normal">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 px-4 pt-2">
              {CORE_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{VOTER_LABELS[key]}</Label>
                  {canEdit ? (
                    <Input
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm">{form[key] || "—"}</p>
                  )}
                </div>
              ))}

              {fieldDefs.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">কাস্টম ফিল্ড</p>
                  <div className="space-y-3">
                    {fieldDefs.map((fd) => (
                      <div key={fd.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{fd.label}</Label>
                        {canEdit ? (
                          <Input
                            value={extra[fd.key] ?? ""}
                            onChange={(e) => setExtra((x) => ({ ...x, [fd.key]: e.target.value }))}
                          />
                        ) : (
                          <p className="text-sm">{extra[fd.key] || "—"}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SheetFooter>
              {canEdit && (
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  সংরক্ষণ করুন
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                বন্ধ করুন
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
