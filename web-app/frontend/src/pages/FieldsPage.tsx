import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { api, type FieldDef } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  text: "টেক্সট", number: "সংখ্যা", date: "তারিখ", boolean: "হ্যাঁ/না", select: "তালিকা থেকে বাছাই",
};

export function FieldsPage() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");

  const { data: fields } = useQuery({
    queryKey: ["field-defs"],
    queryFn: () => api.get<FieldDef[]>("/field-defs").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/field-defs", { key, label, field_type: fieldType }),
    onSuccess: () => {
      toast.success("ফিল্ড যোগ হয়েছে");
      setKey("");
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["field-defs"] });
    },
    onError: () => toast.error("ফিল্ড যোগ করা যায়নি -- এই কী ইতিমধ্যে ব্যবহৃত হতে পারে"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/field-defs/${id}`),
    onSuccess: () => {
      toast.success("ফিল্ড মুছে ফেলা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["field-defs"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">কাস্টম ফিল্ড</h1>
        <p className="text-sm text-muted-foreground">
          ভোটার রেকর্ডে অতিরিক্ত ফিল্ড যোগ করুন -- যেমন মোবাইল নম্বর, নোট ইত্যাদি
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">নতুন ফিল্ড যোগ করুন</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (key && label) createMutation.mutate();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end"
          >
            <div className="space-y-1">
              <Label className="text-xs">কী (ইংরেজিতে, স্পেস ছাড়া)</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value.replace(/\s+/g, "_"))}
                placeholder="mobile_number"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">লেবেল (বাংলায়)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="মোবাইল নম্বর" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ধরন</Label>
              <Select value={fieldType} onValueChange={(v) => v && setFieldType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" /> যোগ করুন
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>কী</TableHead>
              <TableHead>লেবেল</TableHead>
              <TableHead>ধরন</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!fields?.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  <WarmEmptyState icon={ListPlus} title="কোনো কাস্টম ফিল্ড নেই" />
                </TableCell>
              </TableRow>
            )}
            {fields?.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-xs">{f.key}</TableCell>
                <TableCell>{f.label}</TableCell>
                <TableCell>{TYPE_LABELS[f.field_type] ?? f.field_type}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label={`${f.label} মুছুন`} onClick={() => deleteMutation.mutate(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
