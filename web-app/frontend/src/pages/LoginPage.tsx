import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Vote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StampBadge } from "@/components/motifs/StampBadge";
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
      const loggedInUser = await login(username, password);
      // view_reports না থাকা রোলদের (field_search, print_distribution) জন্য ড্যাশবোর্ডের বদলে
      // সরাসরি কুইক সার্চে -- ড্যাশবোর্ড দেখার অনুমতি নেই এমন কাউকে সেখানে পাঠালে রিডাইরেক্ট-লুপ হতো
      navigate(loggedInUser.permissions.includes("view_reports") ? "/dashboard" : "/search", { replace: true });
    } catch {
      setError("ইউজারনেম বা পাসওয়ার্ড ভুল");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="paper-texture flex min-h-screen items-center justify-center p-4">
      {/* "প্রবেশ পাস" -- পুরনো ভর্তি/প্রবেশ টিকিটের অনুভূতি: বাম পাশে ছেঁড়া স্টাব, ড্যাশড বিভাজন রেখা */}
      <div className="flex w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl ring-1 ring-kraft/30">
        <div className="relative flex w-7 shrink-0 flex-col items-center justify-between bg-primary py-4">
          <span className="text-[10px] font-bold tracking-widest text-primary-foreground [writing-mode:vertical-rl]">
            প্রবেশ পাস
          </span>
          <span className="h-3 w-3 rounded-full bg-background" />
          <span className="absolute inset-y-0 left-full w-0 border-l-2 border-dashed border-primary-foreground/40" />
        </div>

        <div className="flex-1 px-7 py-8 sm:px-9">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <StampBadge icon={Vote} className="-rotate-3" />
            <span className="font-heading text-lg font-bold">ভোটার তালিকা অ্যাপ</span>
            <span className="text-xs text-muted-foreground">লগইন করে চালিয়ে যান</span>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <Label htmlFor="username" className="text-[11px] tracking-wide text-muted-foreground uppercase">
                ইউজারনেম
              </Label>
              <input
                id="username"
                className="mt-1 w-full border-0 border-b-[1.5px] border-kraft bg-transparent py-2 text-base outline-none focus-visible:border-primary"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[11px] tracking-wide text-muted-foreground uppercase">
                পাসওয়ার্ড
              </Label>
              <input
                id="password"
                type="password"
                className="mt-1 w-full border-0 border-b-[1.5px] border-kraft bg-transparent py-2 text-base outline-none focus-visible:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                required
              />
            </div>
            {error && (
              <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="stamp-press mt-1 h-11 w-full text-base" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              লগইন
            </Button>
          </form>

          <div className="mt-7 flex items-center gap-2">
            <span className="h-px flex-1 border-t border-dashed border-kraft" />
            <span className="text-[10px] tabular-nums text-muted-foreground">নং ২৬৩৯</span>
            <span className="h-px flex-1 border-t border-dashed border-kraft" />
          </div>
        </div>
      </div>
    </div>
  );
}
