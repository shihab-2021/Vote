import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Save, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Masthead } from "@/components/motifs/Masthead";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { api, type Candidate } from "@/lib/api";

interface TemplateFormState {
  constituency_label: string;
  symbol_name: string;
  slogan: string;
  primary_color: string;
  accent_color: string;
}

function ImageUploadButton({ kind, label }: { kind: "symbol" | "photo"; label: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post(`/candidates/me/image?kind=${kind}`, form);
    },
    onSuccess: () => {
      toast.success("ছবি আপলোড হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["my-candidate"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "আপলোড ব্যর্থ হয়েছে"),
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadMutation.mutate(file);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
        <ImageIcon className="h-3.5 w-3.5" /> {label}
      </Button>
    </>
  );
}

export function MyCampaignPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TemplateFormState>({
    constituency_label: "", symbol_name: "", slogan: "", primary_color: "", accent_color: "",
  });

  const { data: candidate, isLoading, isError } = useQuery({
    queryKey: ["my-candidate"],
    queryFn: () => api.get<Candidate>("/candidates/me").then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (candidate) {
      setForm({
        constituency_label: candidate.constituency_label ?? "",
        symbol_name: candidate.symbol_name ?? "",
        slogan: candidate.slogan ?? "",
        primary_color: candidate.primary_color ?? "",
        accent_color: candidate.accent_color ?? "",
      });
    }
  }, [candidate]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch("/candidates/me", form),
    onSuccess: () => {
      toast.success("সংরক্ষিত হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["my-candidate"] });
    },
    onError: () => toast.error("সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="space-y-6">
        <Masthead eyebrow="স্লিপ ডিজাইন" title="আমার প্রচারণা" />
        <WarmEmptyState
          icon={Megaphone}
          title="কোনো প্রার্থী প্রোফাইলের সাথে যুক্ত নন"
          subtitle="এই পেজটা শুধু candidate রোলের লগইনের জন্য -- আপনার অ্যাকাউন্টের সাথে কোনো প্রার্থী প্রোফাইল যুক্ত নেই"
        />
      </div>
    );
  }

  const primary = form.primary_color || "#1F5B3E";

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="স্লিপ ডিজাইন"
        title="আমার প্রচারণা"
        subtitle="আপনার প্রতীক, ছবি, স্লোগান ও রঙ -- এগুলো দিয়েই আপনার ও আপনার এজেন্টদের তৈরি ভোটার-স্লিপ প্রিন্ট হবে"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{candidate.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">আসন / এলাকা</Label>
                  <Input value={form.constituency_label} onChange={(e) => setForm({ ...form, constituency_label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">প্রতীকের নাম</Label>
                  <Input value={form.symbol_name} onChange={(e) => setForm({ ...form, symbol_name: e.target.value })} placeholder="যেমন: নৌকা" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">স্লোগান</Label>
                  <Input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">প্রধান রঙ (হেক্স)</Label>
                  <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} placeholder="#1F5B3E" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">অ্যাকসেন্ট রঙ (হেক্স)</Label>
                  <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} placeholder="#A6402E" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">ছবি</Label>
                <div className="flex flex-wrap gap-2">
                  <ImageUploadButton kind="symbol" label={candidate.has_symbol_image ? "প্রতীক বদলান" : "প্রতীক আপলোড করুন"} />
                  <ImageUploadButton kind="photo" label={candidate.has_photo_image ? "ছবি বদলান" : "ছবি আপলোড করুন"} />
                </div>
              </div>

              <Button type="submit" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4" /> সংরক্ষণ করুন
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">স্লিপ প্রিভিউ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded border border-kraft">
              <div className="flex items-center gap-2 px-2.5 py-2 text-white" style={{ backgroundColor: primary }}>
                {candidate.has_symbol_image && (
                  <img src={`/api/candidates/${candidate.id}/image/symbol`} alt="প্রতীক" className="h-8 w-8 shrink-0 object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{candidate.name}</div>
                  {form.slogan && <div className="truncate text-[10px] opacity-90">{form.slogan}</div>}
                </div>
                {candidate.has_photo_image && (
                  <img src={`/api/candidates/${candidate.id}/image/photo`} alt="প্রার্থীর ছবি" className="h-8 w-8 shrink-0 rounded object-cover" />
                )}
              </div>
              <div className="space-y-1 bg-card p-2.5 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">ভোটারের নাম</div>
                <div>ভোটার নং: ****</div>
                <div>ওয়ার্ড: **</div>
              </div>
              <div className="px-2.5 pb-2 text-[9px] text-muted-foreground/70">
                এই স্লিপটি ব্যক্তিগত প্রচারণা উপকরণ, নির্বাচন কমিশনের সরকারি নথি নয়
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
