import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { VotersPage } from "@/pages/VotersPage";
import { ConvertPage } from "@/pages/ConvertPage";
import { ImportPage } from "@/pages/ImportPage";
import { FieldsPage } from "@/pages/FieldsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="/voters" element={<VotersPage />} />
              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/convert" element={<ConvertPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/fields" element={<FieldsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
