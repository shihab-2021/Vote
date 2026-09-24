import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { WarmEmptyState } from "@/components/motifs/WarmEmptyState";
import { api, type ActivityLogResponse } from "@/lib/api";

const ACTION_LABEL: Record<string, string> = {
  login: "লগইন",
  user_create: "ব্যবহারকারী তৈরি",
  user_update: "ব্যবহারকারী আপডেট",
  export_voters: "ভোটার এক্সপোর্ট",
  import_excel: "Excel ইমপোর্ট",
  pdf_convert_commit: "PDF কনভার্ট -> ডাটাবেজে যোগ",
  print_batch_create: "প্রিন্ট ব্যাচ তৈরি",
  print_batch_pdf_download: "প্রিন্ট ব্যাচ PDF ডাউনলোড",
  print_batch_distribute_one: "একজনের কার্ড বিতরণ",
  print_batch_distribute_all: "সব কার্ড বিতরণ",
};

function formatDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return "—";
  return Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(", ");
}

export function AuditLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => api.get<ActivityLogResponse>("/activity-logs", { params: { page_size: 100 } }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">অডিট লগ</h1>
        <p className="text-sm text-muted-foreground">
          লগইন, ব্যবহারকারী পরিবর্তন, ডেটা ইমপোর্ট/এক্সপোর্ট ও প্রিন্ট/বিতরণ কার্যক্রমের ইতিহাস
        </p>
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>সময়</TableHead>
              <TableHead>ব্যবহারকারী</TableHead>
              <TableHead>কার্যক্রম</TableHead>
              <TableHead>বিস্তারিত</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && !data?.items.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <WarmEmptyState icon={ScrollText} title="কোনো লগ নেই" />
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("bn-BD")}
                </TableCell>
                <TableCell className="font-medium">{log.username}</TableCell>
                <TableCell>{ACTION_LABEL[log.action] ?? log.action}</TableCell>
                <TableCell className="max-w-96 truncate text-xs text-muted-foreground">
                  {formatDetail(log.detail)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.ip || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
