import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ permission }: { permission?: string }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // "/search" (view_voter) সব সিডেড রোলেরই আছে -- "/"-এ পাঠালে view_reports না-থাকা রোলদের
  // (যেমন print_distribution) জন্য "/"->"/dashboard"->"/" রিডাইরেক্ট-লুপ তৈরি হতো
  if (permission && !user.permissions.includes(permission)) return <Navigate to="/search" replace />;
  return <Outlet />;
}
