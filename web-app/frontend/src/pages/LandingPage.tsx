import { useNavigate } from "react-router-dom";
import { Vote, Search, Printer, MapPin, ShieldCheck, IdCard, Users, Fingerprint, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StampBadge } from "@/components/motifs/StampBadge";
import { PerforatedDivider } from "@/components/motifs/PerforatedDivider";

const FEATURES = [
  {
    icon: Search,
    title: "দ্রুত ভোটার অনুসন্ধান",
    detail: "নাম, ভোটার নম্বর বা ঠিকানা দিয়ে সেকেন্ডে ভোটারের তথ্য খুঁজে বের করুন",
  },
  {
    icon: Printer,
    title: "ভোটার কার্ড প্রিন্ট ও বিতরণ",
    detail: "ফিল্টার করা তালিকা থেকে বাল্ক প্রিন্ট ব্যাচ তৈরি করুন এবং বিতরণ ট্র্যাক করুন",
  },
  {
    icon: MapPin,
    title: "এলাকাভিত্তিক তথ্য সংগঠন",
    detail: "উপজেলা, ইউনিয়ন, ওয়ার্ড ও ঠিকানা অনুযায়ী ভোটার তথ্য সংগঠিত ও ফিল্টার করুন",
  },
  {
    icon: IdCard,
    title: "নাগরিকদের জন্য সহজ যাচাই",
    detail: "যেকোনো নাগরিক নিজের নাম ও জন্ম তারিখ দিয়ে নিজের ভোটার নম্বর যাচাই করতে পারেন",
  },
];

// ভোটের দিনের ছোট ছোট পরিচিত স্মৃতি -- আসল ঐতিহাসিক ছবি নয় (আইনগতভাবে ব্যবহারযোগ্য এমন ছবি
// হাতে নেই), শুধু মূল আইকন দিয়ে তৈরি সংক্ষিপ্ত, রাজনৈতিকভাবে নিরপেক্ষ স্মৃতিচারণ
const MEMORIES = [
  { icon: Users, title: "ভোরবেলা লাইনে দাঁড়ানো", detail: "কেন্দ্র খোলার আগেই লম্বা লাইন" },
  { icon: Fingerprint, title: "আঙুলে কালির দাগ", detail: "ভোট দেওয়ার সেই চেনা প্রমাণ" },
  { icon: Sparkles, title: "প্রথম ভোটের উত্তেজনা", detail: "জীবনের প্রথমবার ভোট দেওয়ার মুহূর্ত" },
  { icon: Mail, title: "ভোটার কার্ড হাতে পাওয়া", detail: "নতুন কার্ড হাতে পাওয়ার অপেক্ষা" },
];

/** সাইট-এর মূল ("/") পাবলিক ল্যান্ডিং পেজ -- না লগইন করা ভিজিটর প্রথমে এটাই দেখেন। AppShell/সাইডবার
 * নেই -- CitizenFindPage/LoginPage-এর মতোই স্বতন্ত্র, পাবলিক লেআউট। লগইন করা ব্যবহারকারীদের জন্য
 * App.tsx-এর HomeRoute এই পেজ না দেখিয়ে সরাসরি /dashboard-এ পাঠিয়ে দেয়। */
export function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="paper-texture flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 pt-12 sm:pt-20">
        <div className="flex flex-col items-center gap-3 text-center">
          <StampBadge icon={Vote} size="lg" className="-rotate-3" />
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
            ভোটার তথ্য খুঁজুন, সংগঠিত করুন, বিতরণ করুন
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            নির্বাচনের আগে ও নির্বাচনের দিনে ভোটার তথ্য দ্রুত খুঁজে পেতে, প্রস্তুত করতে ও বিতরণ করতে
            সাহায্য করার জন্য তৈরি একটি ভোটার তথ্য ও সহায়তা প্ল্যাটফর্ম।
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="stamp-press h-12 px-6 text-base" onClick={() => navigate("/find")}>
              আমার ভোটার তথ্য খুঁজুন
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => navigate("/login")}>
              লগইন
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3 rounded-2xl border border-kraft/30 bg-card p-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium">{f.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <PerforatedDivider />

        <div className="space-y-3">
          <h2 className="font-heading text-center text-lg font-semibold text-ink">ভোটের দিনের স্মৃতি</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MEMORIES.map((m) => (
              <div key={m.title} className="flex flex-col items-center gap-2 text-center">
                <StampBadge icon={m.icon} size="sm" className="bg-stamp" />
                <div>
                  <p className="text-xs font-medium">{m.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <PerforatedDivider />

        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            এটি একটি <span className="font-medium text-foreground">স্বাধীন</span> ভোটার তথ্য সহায়তা প্ল্যাটফর্ম --
            বাংলাদেশ নির্বাচন কমিশন বা কোনো সরকারি প্রতিষ্ঠানের সাথে এর সরাসরি সম্পর্ক নেই। এটি ভোটার
            তথ্য খুঁজে পাওয়া, সংগঠিত করা, প্রিন্ট করা ও বিতরণ করা সহজ করে তোলার একটি টুল মাত্র।
          </p>
        </div>
      </div>

      <footer className="border-t bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground">
        এটি একটি স্বাধীন ভোটার তথ্য সহায়তা প্ল্যাটফর্ম -- বাংলাদেশ নির্বাচন কমিশনের সরকারি ওয়েবসাইট বা সেবা নয়
      </footer>
    </div>
  );
}
