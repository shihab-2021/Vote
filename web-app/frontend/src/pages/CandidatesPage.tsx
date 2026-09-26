import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Image as ImageIcon, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Masthead } from "@/components/motifs/Masthead";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { api, type Candidate } from "@/lib/api";

interface CandidateFormState {
  name: string;
  constituency_label: string;
  symbol_name: string;
  slogan: string;
  primary_color: string;
  accent_color: string;
}

const EMPTY_FORM: CandidateFormState = {
  name: "", constituency_label: "", symbol_name: "", slogan: "", primary_color: "", accent_color: "",
};

function ImageUploadButton({ candidateId, kind, label }: { candidateId: number; kind: "symbol" | "photo"; label: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post(`/candidates/${candidateId}/image?kind=${kind}`, form);
    },
    onSuccess: () => {
      toast.success("ছবি আপলোড হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
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

export function CandidatesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CandidateFormState>(EMPTY_FORM);
  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [editForm, setEditForm] = useState<CandidateFormState>(EMPTY_FORM);
  const [editActive, setEditActive] = useState(true);

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<Candidate[]>("/candidates").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/candidates", form),
    onSuccess: () => {
      toast.success("প্রার্থী তৈরি হয়েছে");
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "প্রার্থী তৈরি করা যায়নি"),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/candidates/${editCandidate!.id}`, { ...editForm, is_active: editActive }),
    onSuccess: () => {
      toast.success("সংরক্ষিত হয়েছে");
      setEditCandidate(null);
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: () => toast.error("সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  function openEdit(c: Candidate) {
    setEditCandidate(c);
    setEditForm({
      name: c.name,
      constituency_label: c.constituency_label ?? "",
      symbol_name: c.symbol_name ?? "",
      slogan: c.slogan ?? "",
      primary_color: c.primary_color ?? "",
      accent_color: c.accent_color ?? "",
    });
    setEditActive(c.is_active);
  }

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="ব্র্যান্ডিং ব্যবস্থাপনা"
        title="প্রার্থী"
        subtitle="নির্বাচনী প্রার্থীদের প্রোফাইল ও তাদের কাস্টমাইজড ভোটার-স্লিপ ডিজাইনের মালিকানা"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন প্রার্থী তৈরি করুন</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (form.name.trim()) createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">প্রার্থীর নাম</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">আসন / এলাকা</Label>
                <Input value={form.constituency_label} onChange={(e) => setForm({ ...form, constituency_label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">প্রতীকের নাম</Label>
                <Input value={form.symbol_name} onChange={(e) => setForm({ ...form, symbol_name: e.target.value })} placeholder="যেমন: নৌকা" />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
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
            <Button type="submit" disabled={createMutation.isPending || !form.name.trim()}>
              <Plus className="h-4 w-4" /> তৈরি করুন
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-auto rounded-lg border border-kraft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>প্রার্থী</TableHead>
              <TableHead>আসন</TableHead>
              <TableHead>প্রতীক</TableHead>
              <TableHead>অবস্থা</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!candidates?.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <WarmEmptyState icon={Award} title="কোনো প্রার্থী নেই" subtitle="উপরের ফর্ম দিয়ে প্রথম প্রার্থী তৈরি করুন" />
                </TableCell>
              </TableRow>
            )}
            {candidates?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.constituency_label || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.symbol_name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.is_active ? "default" : "destructive"}>{c.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" /> এডিট
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!editCandidate} onOpenChange={(open) => !open && setEditCandidate(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {editCandidate && (
            <>
              <SheetHeader>
                <SheetTitle>{editCandidate.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="space-y-1">
                  <Label className="text-xs">প্রার্থীর নাম</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">আসন / এলাকা</Label>
                  <Input value={editForm.constituency_label} onChange={(e) => setEditForm({ ...editForm, constituency_label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">প্রতীকের নাম</Label>
                  <Input value={editForm.symbol_name} onChange={(e) => setEditForm({ ...editForm, symbol_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">স্লোগান</Label>
                  <Input value={editForm.slogan} onChange={(e) => setEditForm({ ...editForm, slogan: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">প্রধান রঙ</Label>
                    <Input value={editForm.primary_color} onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })} placeholder="#1F5B3E" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">অ্যাকসেন্ট রঙ</Label>
                    <Input value={editForm.accent_color} onChange={(e) => setEditForm({ ...editForm, accent_color: e.target.value })} placeholder="#A6402E" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">ছবি</Label>
                  <div className="flex flex-wrap gap-2">
                    <ImageUploadButton candidateId={editCandidate.id} kind="symbol" label={editCandidate.has_symbol_image ? "প্রতীক বদলান" : "প্রতীক আপলোড করুন"} />
                    <ImageUploadButton candidateId={editCandidate.id} kind="photo" label={editCandidate.has_photo_image ? "ছবি বদলান" : "ছবি আপলোড করুন"} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {editCandidate.has_symbol_image && (
                      <img src={`/api/candidates/${editCandidate.id}/image/symbol`} alt="প্রতীক" className="h-12 w-12 rounded border border-kraft object-contain bg-card" />
                    )}
                    {editCandidate.has_photo_image && (
                      <img src={`/api/candidates/${editCandidate.id}/image/photo`} alt="প্রার্থীর ছবি" className="h-12 w-12 rounded border border-kraft object-cover bg-card" />
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editActive} onCheckedChange={(v) => setEditActive(!!v)} />
                  সক্রিয়
                </label>
              </div>
              <SheetFooter>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  সংরক্ষণ করুন
                </Button>
                <Button variant="outline" onClick={() => setEditCandidate(null)}>বন্ধ করুন</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
