import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type FieldDef, type Voter, VOTER_LABELS } from "@/lib/api";

interface RecordDrawerProps {
  voter: Voter | null;
  onClose: () => void;
}

const CORE_KEYS = Object.keys(VOTER_LABELS) as (keyof typeof VOTER_LABELS)[];

export function RecordDrawer({ voter, onClose }: RecordDrawerProps) {
  const queryClient = useQueryClient();
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {voter && (
          <>
            <SheetHeader>
              <SheetTitle>{voter.name}</SheetTitle>
              <SheetDescription>ভোটার নং: {voter.voter_no || "—"}</SheetDescription>
              {voter.is_flagged && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {voter.flag_reasons.map((r) => (
                    <Badge key={r} variant="destructive" className="text-[10px] font-normal">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </SheetHeader>

            <div className="space-y-3 px-4">
              {CORE_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{VOTER_LABELS[key]}</Label>
                  <Input
                    value={form[key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {fieldDefs.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">কাস্টম ফিল্ড</p>
                  <div className="space-y-3">
                    {fieldDefs.map((fd) => (
                      <div key={fd.key} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{fd.label}</Label>
                        <Input
                          value={extra[fd.key] ?? ""}
                          onChange={(e) => setExtra((x) => ({ ...x, [fd.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SheetFooter>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                সংরক্ষণ করুন
              </Button>
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
