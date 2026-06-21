import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  head: () => ({ meta: [{ title: "New job — Hireflow" }] }),
  component: NewJob,
});

function NewJob() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState<"full_time" | "part_time" | "contract" | "internship">("full_time");
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [busy, setBusy] = useState(false);

  const addSkill = (s: string) => {
    const v = s.trim();
    if (v && !skills.includes(v)) setSkills([...skills, v]);
    setSkillInput("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("jobs").insert({
      title, description, location: location || null, employment_type: employmentType,
      status, required_skills: skills, created_by: user.id,
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Job created");
    navigate({ to: "/jobs/$jobId/pipeline", params: { jobId: data.id } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">New job</h1>
      <form onSubmit={submit} className="mt-6 grid gap-5 rounded-lg border border-border bg-card p-6">
        <Field label="Title"><Input required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Description"><Textarea rows={8} maxLength={8000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Role, responsibilities, requirements…" /></Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Location"><Input maxLength={120} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote, NYC…" /></Field>
          <Field label="Type">
            <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as typeof employmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Required skills">
          <div className="flex flex-wrap gap-1 rounded-md border border-input p-2">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input
              className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
              value={skillInput}
              placeholder={skills.length ? "" : "React, TypeScript, SQL…"}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); }
                if (e.key === "Backspace" && !skillInput && skills.length) setSkills(skills.slice(0, -1));
              }}
              onBlur={() => skillInput && addSkill(skillInput)}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Press Enter or comma to add. Used for AI candidate matching.</p>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create job"}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}