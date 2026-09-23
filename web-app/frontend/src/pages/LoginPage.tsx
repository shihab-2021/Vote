import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Vote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("ইউজারনেম বা পাসওয়ার্ড ভুল");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-sm overflow-hidden py-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary to-destructive" />
        <CardHeader className="items-center pt-6 text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Vote className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">ভোটার তালিকা অ্যাপ</CardTitle>
          <CardDescription>লগইন করে চালিয়ে যান</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">ইউজারনেম</Label>
              <Input
                id="username"
                className="h-11"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">পাসওয়ার্ড</Label>
              <Input
                id="password"
                type="password"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              লগইন
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
