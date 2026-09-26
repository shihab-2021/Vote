import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, Pencil, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { api, type Candidate, type RoleDef, type User } from "@/lib/api";

const CANDIDATE_ROLE_KEYS = ["candidate", "candidate_agent"];

const SCOPE_FIELD_OPTIONS = [
  { value: "upazila", label: "উপজেলা" },
  { value: "union_name", label: "ইউনিয়ন" },
  { value: "ward", label: "ওয়ার্ড" },
  { value: "area_no", label: "এলাকা নং" },
  { value: "area_name", label: "এলাকার নাম" },
];

interface ScopeRow {
  scope_field: string;
  scope_value: string;
}

function ScopeEditor({ rows, onChange }: { rows: ScopeRow[]; onChange: (rows: ScopeRow[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">এলাকা-স্কোপ (খালি রাখলে কিছুই দেখতে পারবেন না -- super_admin ছাড়া)</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { scope_field: "ward", scope_value: "" }])}>
          <Plus className="h-3.5 w-3.5" /> স্কোপ যোগ করুন
        </Button>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Select value={row.scope_field} onValueChange={(v) => {
            if (!v) return;
            const next = [...rows]; next[idx] = { ...row, scope_field: v }; onChange(next);
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue>{(v: string | null) => SCOPE_FIELD_OPTIONS.find((o) => o.value === v)?.label ?? "বাছাই করুন"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SCOPE_FIELD_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            placeholder="মান লিখুন (যেমন: 1)"
            value={row.scope_value}
            onChange={(e) => {
              const next = [...rows]; next[idx] = { ...row, scope_value: e.target.value }; onChange(next);
            }}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="এই স্কোপ মুছুন" onClick={() => onChange(rows.filter((_, i) => i !== idx))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<number | null>(null);
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [newScopes, setNewScopes] = useState<ScopeRow[]>([]);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [editCandidateId, setEditCandidateId] = useState<number | null>(null);
  const [editScopes, setEditScopes] = useState<ScopeRow[]>([]);
  const [editActive, setEditActive] = useState(true);

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<RoleDef[]>("/roles").then((r) => r.data),
  });
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users").then((r) => r.data),
  });
  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get<Candidate[]>("/candidates").then((r) => r.data),
  });

  const roleIsCandidate = (id: number | null) =>
    !!id && CANDIDATE_ROLE_KEYS.includes(roles?.find((r) => r.id === id)?.key ?? "");

  const createMutation = useMutation({
    mutationFn: () => api.post("/users", {
      username, password, role_id: roleId,
      candidate_id: roleIsCandidate(roleId) ? candidateId : null,
      area_scopes: newScopes.filter((s) => s.scope_value.trim()),
    }),
    onSuccess: () => {
      toast.success("ব্যবহারকারী তৈরি হয়েছে");
      setUsername(""); setPassword(""); setRoleId(null); setCandidateId(null); setNewScopes([]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "ব্যবহারকারী তৈরি করা যায়নি"),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/users/${editUser!.id}`, {
      role_id: editRoleId,
      candidate_id: roleIsCandidate(editRoleId) ? editCandidateId : null,
      is_active: editActive,
      area_scopes: editScopes.filter((s) => s.scope_value.trim()),
    }),
    onSuccess: () => {
      toast.success("সংরক্ষিত হয়েছে");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  function openEdit(u: User) {
    setEditUser(u);
    setEditRoleId(roles?.find((r) => r.key === u.role)?.id ?? null);
    setEditCandidateId(u.candidate_id);
    setEditScopes(u.area_scopes.map((s) => ({ scope_field: s.scope_field, scope_value: s.scope_value })));
    setEditActive(u.is_active);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ব্যবহারকারী</h1>
        <p className="text-sm text-muted-foreground">
          রোল ও এলাকা-স্কোপ অনুযায়ী কে কোন ভোটার-ডেটা দেখতে/পরিচালনা করতে পারবেন তা নিয়ন্ত্রণ করুন
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন ব্যবহারকারী তৈরি করুন</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (username && password && roleId) createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">ইউজারনেম</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">পাসওয়ার্ড</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">রোল</Label>
                <Select value={roleId ? String(roleId) : ""} onValueChange={(v) => v && setRoleId(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{() => roles?.find((r) => r.id === roleId)?.label ?? "রোল বাছাই করুন"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((r) => (<SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {roleIsCandidate(roleId) && (
              <div className="space-y-1">
                <Label className="text-xs">প্রার্থী</Label>
                <Select value={candidateId ? String(candidateId) : ""} onValueChange={(v) => v && setCandidateId(Number(v))}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue>{() => candidates?.find((c) => c.id === candidateId)?.name ?? "প্রার্থী বাছাই করুন"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {candidates?.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ScopeEditor rows={newScopes} onChange={setNewScopes} />
            <Button type="submit" disabled={createMutation.isPending || !username || !password || !roleId}>
              <Plus className="h-4 w-4" /> তৈরি করুন
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ইউজারনেম</TableHead>
              <TableHead>রোল</TableHead>
              <TableHead>এলাকা-স্কোপ</TableHead>
              <TableHead>অবস্থা</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!users?.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <WarmEmptyState icon={UserCog} title="কোনো ব্যবহারকারী নেই" />
                </TableCell>
              </TableRow>
            )}
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.role_label}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.area_scopes.length
                    ? u.area_scopes.map((s) => `${SCOPE_FIELD_OPTIONS.find((o) => o.value === s.scope_field)?.label ?? s.scope_field}=${s.scope_value}`).join(", ")
                    : (u.role === "super_admin" ? "সব" : "কোনোটাই না")}
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" /> এডিট
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {editUser && (
            <>
              <SheetHeader>
                <SheetTitle>{editUser.username}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="space-y-1">
                  <Label className="text-xs">রোল</Label>
                  <Select value={editRoleId ? String(editRoleId) : ""} onValueChange={(v) => v && setEditRoleId(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{() => roles?.find((r) => r.id === editRoleId)?.label ?? "রোল বাছাই করুন"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((r) => (<SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {roleIsCandidate(editRoleId) && (
                  <div className="space-y-1">
                    <Label className="text-xs">প্রার্থী</Label>
                    <Select value={editCandidateId ? String(editCandidateId) : ""} onValueChange={(v) => v && setEditCandidateId(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{() => candidates?.find((c) => c.id === editCandidateId)?.name ?? "প্রার্থী বাছাই করুন"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {candidates?.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <ScopeEditor rows={editScopes} onChange={setEditScopes} />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editActive} onCheckedChange={(v) => setEditActive(!!v)} />
                  সক্রিয় (বন্ধ করলে এই ব্যবহারকারী আর লগইন করতে পারবেন না)
                </label>
              </div>
              <SheetFooter>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  সংরক্ষণ করুন
                </Button>
                <Button variant="outline" onClick={() => setEditUser(null)}>বন্ধ করুন</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
