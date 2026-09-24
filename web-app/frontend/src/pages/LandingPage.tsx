import { useNavigate } from "react-router-dom";
import { Vote, Search, Printer, MapPin, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StampBadge } from "@/components/motifs/StampBadge";
import { LedgerRow } from "@/components/motifs/LedgerRow";
import { PostalTag } from "@/components/motifs/PostalTag";

const FEATURES = [
  { icon: Search, title: "দ্রুত ভোটার অনুসন্ধান", detail: "নাম, নম্বর বা ঠিকানা দিয়ে" },
  { icon: Printer, title: "ভোটার কার্ড প্রিন্ট ও বিতরণ", detail: "বাল্ক ব্যাচ ও ট্র্যাকিং" },
  { icon: MapPin, title: "এলাকাভিত্তিক তথ্য সংগঠন", detail: "উপজেলা, ওয়ার্ড, ঠিকানা" },
  { icon: IdCard, title: "নাগরিকদের জন্য সহজ যাচাই", detail: "নাম ও জন্ম তারিখ দিয়ে" },
];

// ভোটের দিনের ছোট ছোট পরিচিত স্মৃতি -- আসল ঐতিহাসিক ছবি নয় (আইনগতভাবে ব্যবহারযোগ্য এমন ছবি
// হাতে নেই), শুধু মূল আইকন দিয়ে তৈরি সংক্ষিপ্ত, রাজনৈতিকভাবে নিরপেক্ষ স্মৃতিচারণ
const MEMORIES = [
  { label: "ভোরবেলা লাইনে দাঁড়ানো", rotate: "-rotate-1" },
  { label: "আঙুলে কালির দাগ", rotate: "rotate-1" },
  { label: "প্রথম ভোটের উত্তেজনা", rotate: "-rotate-1" },
];

/** সাইট-এর মূল ("/") পাবলিক ল্যান্ডিং পেজ -- না লগইন করা ভিজিটর প্রথমে এটাই দেখেন। AppShell/সাইডবার
 * নেই -- CitizenFindPage/LoginPage-এর মতোই স্বতন্ত্র, পাবলিক লেআউট। লগইন করা ব্যবহারকারীদের জন্য
 * App.tsx-এর HomeRoute এই পেজ না দেখিয়ে সরাসরি /dashboard-এ পাঠিয়ে দেয়। */
export function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="paper-texture flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 pt-10 sm:gap-7 sm:pt-16">

        {/* মাস্টহেড */}
        <div className="flex flex-col gap-2 text-center">
          <div className="relative h-[3px] bg-foreground"><div className="absolute inset-x-0 top-[5px] h-px bg-foreground" /></div>
          <div className="flex flex-col items-center gap-2 py-2">
            <StampBadge icon={Vote} size="lg" className="-rotate-3" />
            <div className="text-[10.5px] font-semibold tracking-widest text-muted-foreground uppercase">
              স্বাধীন ভোটার তথ্য ও সহায়তা প্ল্যাটফর্ম
            </div>
            <h1 className="font-heading text-2xl leading-snug font-bold sm:text-3xl">
              ভোটার তথ্য খুঁজুন, সংগঠিত করুন,<br className="hidden sm:block" /> বিতরণ করুন
            </h1>
          </div>
          <div className="relative h-[3px] bg-foreground"><div className="absolute inset-x-0 -top-[5px] h-px bg-foreground" /></div>
        </div>

        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button size="lg" className="stamp-press h-12 px-6 text-base" onClick={() => navigate("/find")}>
            আমার ভোটার তথ্য খুঁজুন
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => navigate("/login")}>
            লগইন
          </Button>
        </div>

        {/* ফিচার তালিকা -- বক্সের বদলে লেজার-স্টাইল ডটেড লিডার */}
        <div className="flex flex-col gap-3 rounded border border-kraft bg-card p-5 sm:p-6">
          {FEATURES.map((f) => (
            <LedgerRow
              key={f.title}
              label={f.title}
              value={<span className="text-xs font-normal text-muted-foreground sm:text-sm">{f.detail}</span>}
              valueClassName="font-sans"
            />
          ))}
        </div>

        <div className="h-px bg-[repeating-linear-gradient(to_right,var(--kraft)_0,var(--kraft)_6px,transparent_6px,transparent_12px)]" />

        {/* স্মৃতি-স্ট্রিপ */}
        <div className="flex flex-col gap-3">
          <div className="text-center text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            ভোটের দিনের স্মৃতি
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MEMORIES.map((m) => (
              <PostalTag key={m.label} value={m.label} rotate={m.rotate} className="flex items-center py-3" />
            ))}
          </div>
        </div>

        <div className="h-px bg-[repeating-linear-gradient(to_right,var(--kraft)_0,var(--kraft)_6px,transparent_6px,transparent_12px)]" />

        {/* নোটিশ */}
        <div className="flex items-start gap-3 rounded border border-dashed border-primary bg-card p-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary text-sm font-bold text-primary">!</div>
          <p className="text-sm text-muted-foreground">
            এটি একটি <span className="font-medium text-foreground">স্বাধীন</span> ভোটার তথ্য সহায়তা প্ল্যাটফর্ম --
            বাংলাদেশ নির্বাচন কমিশন বা কোনো সরকারি প্রতিষ্ঠানের সাথে এর সরাসরি সম্পর্ক নেই। এটি ভোটার
            তথ্য খুঁজে পাওয়া, সংগঠিত করা, প্রিন্ট করা ও বিতরণ করা সহজ করে তোলার একটি টুল মাত্র।
          </p>
        </div>
      </div>

      <footer className="border-t border-kraft/50 bg-secondary/40 px-4 py-4 text-center text-xs text-muted-foreground">
        এটি একটি স্বাধীন ভোটার তথ্য সহায়তা প্ল্যাটফর্ম -- বাংলাদেশ নির্বাচন কমিশনের সরকারি ওয়েবসাইট বা সেবা নয়
      </footer>
    </div>
  );
}
