import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Vote, Loader2, Search, MapPin, IdCard, ShieldCheck, ListChecks, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type PublicLookupResult } from "@/lib/api";

const HOW_IT_WORKS = [
  { title: "নাম, পিতার নাম ও জন্ম তারিখ দিন", detail: "ভোটার তালিকায় যেভাবে লেখা আছে হুবহু সেভাবে" },
  { title: "হুবহু মিল খোঁজা হয়", detail: "শুধু আংশিক মিলে কোনো ফলাফল দেখানো হয় না -- এটা আপনার তথ্যের সুরক্ষার জন্য" },
  { title: "আপনার ভোটার তথ্য দেখুন", detail: "ভোটার নম্বর, ক্রমিক নং ও ভোটকেন্দ্রের এলাকা" },
];

const FAQ = [
  {
    q: "আমার তথ্য কেন পাওয়া যাচ্ছে না?",
    a: "নাম, পিতার নাম ও জন্ম তারিখ ভোটার তালিকায় যেভাবে লেখা আছে হুবহু সেভাবে মিলতে হবে -- বানান বা ফরম্যাট (যেমন তারিখের ধরন) একটু আলাদা হলেও ফলাফল আসবে না। এছাড়া এই এলাকার তথ্য এখনো ডিজিটাইজ করা নাও হতে পারে।",
  },
  {
    q: "আমার ঠিকানা বা পিতামাতার নাম কেন দেখানো হয় না?",
    a: "আপনার সুরক্ষার জন্য এই পাতায় শুধু নির্বাচন-সংক্রান্ত তথ্য (ভোটার নম্বর, ক্রমিক নং, ভোটকেন্দ্রের এলাকা) দেখানো হয় -- ঠিকানা, পেশা বা পিতামাতার নাম কখনো ফেরত দেওয়া হয় না।",
  },
  {
    q: "এই তথ্য কি নিরাপদ?",
    a: "হ্যাঁ -- অনুসন্ধানের জন্য যে তথ্য আপনি দিচ্ছেন (নাম, পিতার নাম, জন্ম তারিখ) তা শুধু হুবহু মিল যাচাইয়ের জন্য ব্যবহার হয় এবং বারবার চেষ্টা সীমিত রাখা হয়েছে।",
  },
  {
    q: "এটা কি সরকারি ওয়েবসাইট?",
    a: "না -- এটি একটি স্বাধীন ভোটার তথ্য সহায়তা প্ল্যাটফর্ম, বাংলাদেশ নির্বাচন কমিশনের সরকারি সেবা নয়।",
  },
];

/** পাবলিক (লগইন ছাড়া) পেজ -- একজন নাগরিক নিজের নাম+পিতার নাম+জন্ম তারিখ দিয়ে নিজের ভোটার নম্বর ও
 * ভোটকেন্দ্রের তথ্য যাচাই করতে পারেন। AppShell/সাইডবার নেই -- এটা অ্যাডমিন অ্যাপ থেকে সম্পূর্ণ
 * আলাদা, সাধারণ মানুষের জন্য তৈরি একটা স্বতন্ত্র পাতা। ফর্মের নিচে "কীভাবে কাজ করে" ও FAQ যোগ করা
 * হয়েছে যাতে এটা শুধু একটা ফর্ম না হয়ে ছোট একটা হোমপেজের মতো কাজ করে। */
export function CitizenFindPage() {
  const [name, setName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [dob, setDob] = useState("");
  const [motherName, setMotherName] = useState("");
  const [result, setResult] = useState<PublicLookupResult | null>(null);

  const lookup = useMutation({
    mutationFn: () =>
      api.post<PublicLookupResult>("/public/voter-lookup", {
        name, father_name: fatherName, dob,
        mother_name: motherName || undefined,
      }).then((r) => r.data),
    onSuccess: (data) => setResult(data),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    lookup.mutate();
  }

  const rateLimited = (lookup.error as { response?: { status?: number } } | undefined)?.response?.status === 429;
  const hasError = lookup.isError || (result && !result.found);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 pt-10 sm:pt-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Vote className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">আপনার ভোটার তথ্য যাচাই করুন</h1>
          <p className="text-sm text-muted-foreground">
            নাম, পিতার নাম ও জন্ম তারিখ দিন -- আপনার ভোটার নম্বর ও ভোট কেন্দ্রের তথ্য দেখতে পাবেন
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="name">আপনার নাম</Label>
            <Input
              id="name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)}
              aria-invalid={hasError || undefined} aria-describedby={hasError ? "lookup-status" : undefined} required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="father_name">পিতার নাম</Label>
            <Input
              id="father_name" className="h-12 text-base" value={fatherName} onChange={(e) => setFatherName(e.target.value)}
              aria-invalid={hasError || undefined} aria-describedby={hasError ? "lookup-status" : undefined} required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">জন্ম তারিখ (যেমন: ১৫/০৩/১৯৯০)</Label>
            <Input
              id="dob" className="h-12 text-base" value={dob} onChange={(e) => setDob(e.target.value)}
              aria-invalid={hasError || undefined} aria-describedby={hasError ? "lookup-status" : undefined} required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mother_name">মাতার নাম (ঐচ্ছিক -- একাধিক ফলাফল মিললে প্রয়োজন হবে)</Label>
            <Input id="mother_name" className="h-12 text-base" value={motherName} onChange={(e) => setMotherName(e.target.value)} />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={lookup.isPending}>
            {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            খুঁজুন
          </Button>
        </form>

        {rateLimited && (
          <div id="lookup-status" role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
            অনেকবার চেষ্টা করা হয়েছে -- কিছুক্ষণ পর আবার চেষ্টা করুন
          </div>
        )}

        {!rateLimited && lookup.isError && (
          <div id="lookup-status" role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
            কিছু একটা সমস্যা হয়েছে -- আবার চেষ্টা করুন
          </div>
        )}

        {result && !result.found && !result.need_mother_name && (
          <div id="lookup-status" role="alert" className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            <p className="font-medium text-foreground">কোনো তথ্য পাওয়া যায়নি</p>
            <p className="mt-1 text-sm">নাম, পিতার নাম ও জন্ম তারিখ সঠিকভাবে (তালিকায় যেভাবে আছে) লিখেছেন কিনা যাচাই করুন</p>
          </div>
        )}

        {result && result.need_mother_name && (
          <div id="lookup-status" role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center text-sm">
            একই তথ্যে একাধিক ব্যক্তি মিলেছে -- অনুগ্রহ করে উপরে মাতার নাম দিয়ে আবার খুঁজুন
          </div>
        )}

        {result?.found && result.voter && (
          <div className="space-y-2 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-medium">তথ্য পাওয়া গেছে</span>
            </div>
            <p className="text-lg font-semibold">{result.voter.name}</p>
            <div className="grid grid-cols-1 gap-2 pt-2 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <span>ভোটার নং: <span className="font-medium">{result.voter.voter_no || "—"}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <span>ক্রমিক নং: <span className="font-medium">{result.voter.serial_no || "—"}</span></span>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {[result.voter.upazila, result.voter.union_name, result.voter.ward && `ওয়ার্ড ${result.voter.ward}`, result.voter.area_name]
                    .filter(Boolean).join(", ") || "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4 text-primary" />
            কীভাবে কাজ করে
          </div>
          <ol className="space-y-2.5">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{step.title}</span>
                  <span className="block text-xs text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HelpCircle className="h-4 w-4 text-primary" />
            সাধারণ জিজ্ঞাসা
          </div>
          <div className="divide-y">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-2.5 first:pt-0 last:pb-0">
                <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
                  {item.q}
                </summary>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <footer className="border-t bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground">
        এটি একটি স্বাধীন ভোটার তথ্য সহায়তা প্ল্যাটফর্ম -- বাংলাদেশ নির্বাচন কমিশনের সরকারি ওয়েবসাইট বা সেবা নয়
      </footer>
    </div>
  );
}
