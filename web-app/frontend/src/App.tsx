import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { LandingPage } from "@/pages/LandingPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { VotersPage } from "@/pages/VotersPage";
import { QuickSearchPage } from "@/pages/QuickSearchPage";
import { ConvertPage } from "@/pages/ConvertPage";
import { ImportPage } from "@/pages/ImportPage";
import { FieldsPage } from "@/pages/FieldsPage";
import { UsersPage } from "@/pages/UsersPage";
import { PrintBatchesPage } from "@/pages/PrintBatchesPage";
import { PrintBatchDetailPage } from "@/pages/PrintBatchDetailPage";
import { CitizenFindPage } from "@/pages/CitizenFindPage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { Loader2 } from "lucide-react";

/** রুট ("/") -- না লগইন করা ভিজিটরের জন্য পাবলিক LandingPage, লগইন করা থাকলে সরাসরি /dashboard-এ।
 * এভাবে staff-দের জন্য "/" এখনো কার্যত ড্যাশবোর্ডের মতোই কাজ করে, কিন্তু নতুন ভিজিটর প্রথমে
 * সরাসরি লগইন ফর্মের বদলে প্ল্যাটফর্ম সম্পর্কে একটা ব্যাখ্যা দেখেন। */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/find" element={<CitizenFindPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route element={<ProtectedRoute permission="view_reports" />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="view_voter" />}>
                <Route path="/voters" element={<VotersPage />} />
                <Route path="/search" element={<QuickSearchPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="print_voter" />}>
                <Route path="/print" element={<PrintBatchesPage />} />
                <Route path="/print/:id" element={<PrintBatchDetailPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="manage_data" />}>
                <Route path="/convert" element={<ConvertPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/fields" element={<FieldsPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="manage_users" />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route element={<ProtectedRoute permission="view_audit_logs" />}>
                <Route path="/audit-logs" element={<AuditLogPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
