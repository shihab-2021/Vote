import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, type PrintBatchSummary } from "@/lib/api";

export function PrintBatchesPage() {
  const navigate = useNavigate();
  const { data: batches, isLoading } = useQuery({
    queryKey: ["print-batches"],
    queryFn: () => api.get<PrintBatchSummary[]>("/print-batches").then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">প্রিন্ট ও বিতরণ</h1>
        <p className="text-sm text-muted-foreground">
          ভোটার তালিকা পেজে ফিল্টার করে "প্রিন্ট ব্যাচ তৈরি করুন" চাপলে সেই ব্যাচ এখানে দেখা যাবে
        </p>
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ব্যাচ</TableHead>
              <TableHead>তৈরি হয়েছে</TableHead>
              <TableHead className="text-right">মোট</TableHead>
              <TableHead className="text-right">প্রিন্ট হয়েছে</TableHead>
              <TableHead className="text-right">বিতরণ হয়েছে</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && !batches?.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  কোনো প্রিন্ট ব্যাচ নেই -- ভোটার তালিকা পেজ থেকে ফিল্টার করে একটা তৈরি করুন
                </TableCell>
              </TableRow>
            )}
            {batches?.map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/print/${b.id}`)}>
                <TableCell className="font-medium">{b.label}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString("bn-BD")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{b.voter_count}</TableCell>
                <TableCell className="text-right tabular-nums">{b.printed_count}</TableCell>
                <TableCell className="text-right tabular-nums">{b.distributed_count}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/print/${b.id}`)}>
                    <Printer className="h-3.5 w-3.5" /> দেখুন
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
