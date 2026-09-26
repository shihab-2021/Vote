import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Users2 } from "lucide-react";
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
import { useAuth } from "@/auth/AuthContext";
import { api, type User } from "@/lib/api";

const SCOPE_FIELD_LABELS: Record<string, string> = {
  upazila: "উপজেলা", union_name: "ইউনিয়ন", ward: "ওয়ার্ড", area_no: "এলাকা নং", area_name: "এলাকার নাম",
};

interface ScopeKey { scope_field: string; scope_value: string }

/** candidate নিজের যে এলাকা-স্কোপ পেয়েছেন, তার একটা উপসেট নির্বাচন করে এজেন্টকে দেওয়া যায় --
 * ফ্রি-টেক্সট এন্ট্রি না দিয়ে চেকবক্স, যাতে ব্যাকএন্ডের সাবসেট-ভ্যালিডেশন কখনো ব্যর্থ না হয়। */
function ScopePicker({ owned, selected, onChange }: { owned: ScopeKey[]; selected: ScopeKey[]; onChange: (rows: ScopeKey[]) => void }) {
  function toggle(row: ScopeKey, checked: boolean) {
    if (checked) onChange([...selected, row]);
    else onChange(selected.filter((s) => !(s.scope_field === row.scope_field && s.scope_value === row.scope_value)));
  }
  if (!owned.length) {
    return <p className="text-xs text-muted-foreground">আপনার নিজের কোনো এলাকা-স্কোপ নেই -- এজেন্টকে এলাকা দেওয়া যাবে না।</p>;
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs">এলাকা-স্কোপ (আপনার নিজের এলাকার মধ্যে থেকে বেছে দিন)</Label>
      <div className="space-y-1.5">
        {owned.map((row, idx) => {
          const checked = selected.some((s) => s.scope_field === row.scope_field && s.scope_value === row.scope_value);
          return (
            <label key={idx} className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => toggle(row, !!v)} />
              {SCOPE_FIELD_LABELS[row.scope_field] ?? row.scope_field} = {row.scope_value}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function MyAgentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ownedScopes: ScopeKey[] = (user?.area_scopes ?? []).map((s) => ({ scope_field: s.scope_field, scope_value: s.scope_value }));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newScopes, setNewScopes] = useState<ScopeKey[]>([]);
  const [editAgent, setEditAgent] = useState<User | null>(null);
  const [editScopes, setEditScopes] = useState<ScopeKey[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");

  const { data: agents } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users").then((r) => r.data),
    enabled: !!user?.candidate_id,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/users", { username, password, area_scopes: newScopes }),
    onSuccess: () => {
      toast.success("এজেন্ট তৈরি হয়েছে");
      setUsername(""); setPassword(""); setNewScopes([]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "এজেন্ট তৈরি করা যায়নি"),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/users/${editAgent!.id}`, {
      is_active: editActive,
      area_scopes: editScopes,
      ...(editPassword ? { password: editPassword } : {}),
    }),
    onSuccess: () => {
      toast.success("সংরক্ষিত হয়েছে");
      setEditAgent(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  function openEdit(a: User) {
    setEditAgent(a);
    setEditScopes(a.area_scopes.map((s) => ({ scope_field: s.scope_field, scope_value: s.scope_value })));
    setEditActive(a.is_active);
    setEditPassword("");
  }

  if (!user?.candidate_id) {
    return (
      <div className="space-y-6">
        <Masthead eyebrow="দল" title="আমার এজেন্ট" />
        <WarmEmptyState
          icon={Users2}
          title="কোনো প্রার্থী প্রোফাইলের সাথে যুক্ত নন"
          subtitle="এই পেজটা শুধু candidate রোলের লগইনের জন্য -- আপনার অ্যাকাউন্টের সাথে কোনো প্রার্থী প্রোফাইল যুক্ত নেই"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="দল"
        title="আমার এজেন্ট"
        subtitle="আপনার হয়ে ভোটার-স্লিপ প্রিন্ট করবেন এমন এজেন্ট তৈরি করুন -- তারা শুধু আপনার এলাকার মধ্যে কাজ করতে পারবেন"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন এজেন্ট তৈরি করুন</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (username && password) createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">ইউজারনেম</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">পাসওয়ার্ড</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <ScopePicker owned={ownedScopes} selected={newScopes} onChange={setNewScopes} />
            <Button type="submit" disabled={createMutation.isPending || !username || !password}>
              <Plus className="h-4 w-4" /> তৈরি করুন
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-auto rounded-lg border border-kraft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ইউজারনেম</TableHead>
              <TableHead>এলাকা-স্কোপ</TableHead>
              <TableHead>অবস্থা</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!agents?.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  <WarmEmptyState icon={Users2} title="কোনো এজেন্ট নেই" subtitle="উপরের ফর্ম দিয়ে প্রথম এজেন্ট তৈরি করুন" />
                </TableCell>
              </TableRow>
            )}
            {agents?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.username}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.area_scopes.length
                    ? a.area_scopes.map((s) => `${SCOPE_FIELD_LABELS[s.scope_field] ?? s.scope_field}=${s.scope_value}`).join(", ")
                    : "কোনোটাই না"}
                </TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "destructive"}>{a.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" /> এডিট
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!editAgent} onOpenChange={(open) => !open && setEditAgent(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {editAgent && (
            <>
              <SheetHeader>
                <SheetTitle>{editAgent.username}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="space-y-1">
                  <Label className="text-xs">নতুন পাসওয়ার্ড (ঐচ্ছিক)</Label>
                  <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="খালি রাখলে বদলাবে না" />
                </div>
                <ScopePicker owned={ownedScopes} selected={editScopes} onChange={setEditScopes} />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editActive} onCheckedChange={(v) => setEditActive(!!v)} />
                  সক্রিয় (বন্ধ করলে এই এজেন্ট আর লগইন করতে পারবেন না)
                </label>
              </div>
              <SheetFooter>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  সংরক্ষণ করুন
                </Button>
                <Button variant="outline" onClick={() => setEditAgent(null)}>বন্ধ করুন</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
