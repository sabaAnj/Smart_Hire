import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { extractResumeText } from "@/lib/parse-resume";

export const Route = createFileRoute("/jobs/$jobId")({
  component: JobDetail,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Role not found</h1>
        <p className="mt-2 text-muted-foreground">This role may have been closed.</p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary underline">Back to all roles</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", resume_text: "" });
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5 MB.");
      return;
    }
    setParsing(true);
    try {
      const text = await extractResumeText(file);
      if (!text.trim()) throw new Error("Couldn't extract any text from this file.");
      setForm((f) => ({ ...f, resume_text: text.slice(0, 20000) }));
      setFileName(file.name);
      toast.success(`Loaded ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setParsing(false);
    }
  };

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, description, location, employment_type, required_skills, status")
        .eq("id", jobId)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.email || !form.resume_text) {
        throw new Error("Name, email and resume are required.");
      }
      const { data: candidate, error: cErr } = await supabase
        .from("candidates")
        .insert({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          resume_text: form.resume_text,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      const { error: aErr } = await supabase
        .from("applications")
        .insert({ job_id: jobId, candidate_id: candidate.id });
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Application submitted!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All roles
        </Link>
        {isLoading || !job ? (
          <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {job.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.location}</span>}
              <span className="capitalize">{job.employment_type.replace("_", " ")}</span>
            </div>
            <div className="mt-6 whitespace-pre-wrap rounded-lg border border-border bg-card p-6 text-sm leading-relaxed text-foreground">
              {job.description || "No description provided."}
            </div>
            {job.required_skills?.length ? (
              <div className="mt-4">
                <p className="text-sm font-medium">Required skills</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {job.required_skills.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-10 rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Apply for this role</h2>
              {submitted ? (
                <div className="mt-4 flex items-start gap-3 rounded-md border border-border bg-accent/40 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Thanks for applying!</p>
                    <p className="text-sm text-muted-foreground">We'll review your resume and be in touch shortly.</p>
                  </div>
                </div>
              ) : (
                <form
                  className="mt-4 grid gap-4"
                  onSubmit={(e) => { e.preventDefault(); apply.mutate(); }}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="full_name">Full name</Label>
                      <Input id="full_name" required maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" required maxLength={200} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="resume_text">Paste your resume</Label>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                        {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {parsing ? "Reading…" : "Upload resume file"}
                        <input
                          type="file"
                          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                          className="hidden"
                          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
                      <span className="text-xs text-muted-foreground">or paste below</span>
                    </div>
                    <Textarea id="resume_text" required rows={10} maxLength={20000} placeholder="Paste your resume as plain text…" value={form.resume_text} onChange={(e) => setForm({ ...form, resume_text: e.target.value })} />
                    <p className="text-xs text-muted-foreground">We use AI to extract your skills and experience for the recruiter.</p>
                  </div>
                  <div>
                    <Button type="submit" disabled={apply.isPending}>
                      {apply.isPending ? "Submitting…" : "Submit application"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}