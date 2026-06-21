import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeApplication } from "@/lib/ats.functions";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, CalendarPlus, Loader2 } from "lucide-react";

type Stage = Database["public"]["Enums"]["pipeline_stage"];
const STAGES: { id: Stage; label: string }[] = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];

export const Route = createFileRoute("/_authenticated/jobs/$jobId/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — Hireflow" }] }),
  component: Pipeline,
});

type AppRow = {
  id: string;
  stage: Stage;
  match_score: number | null;
  match_summary: string | null;
  matched_skills: string[];
  missing_skills: string[];
  candidate: { id: string; full_name: string; email: string; parsed_skills: string[]; experience_years: number | null; summary: string | null; resume_text: string };
};

function Pipeline() {
  const { jobId } = Route.useParams();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeApplication);

  const { data: job } = useQuery({
    queryKey: ["job", jobId, "full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("id, title, status, required_skills").eq("id", jobId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: apps = [] } = useQuery({
    queryKey: ["applications", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, stage, match_score, match_summary, matched_skills, missing_skills, candidate:candidates(id, full_name, email, parsed_skills, experience_years, summary, resume_text)")
        .eq("job_id", jobId)
        .order("match_score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AppRow[];
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("applications").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["applications", jobId] });
      const prev = qc.getQueryData<AppRow[]>(["applications", jobId]);
      qc.setQueryData<AppRow[]>(["applications", jobId], (old) => old?.map((a) => (a.id === id ? { ...a, stage } : a)) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["applications", jobId], ctx.prev); toast.error("Failed to move"); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["applications", jobId] }),
  });

  const runAnalyze = useMutation({
    mutationFn: async (applicationId: string) => analyze({ data: { applicationId } }),
    onSuccess: () => { toast.success("AI analysis complete"); qc.invalidateQueries({ queryKey: ["applications", jobId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job?.title ?? "Job"}</h1>
          <p className="text-sm text-muted-foreground">{apps.length} candidate{apps.length === 1 ? "" : "s"} in pipeline</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => {
          const list = apps.filter((a) => a.stage === s.id);
          return (
            <div
              key={s.id}
              className="rounded-lg border border-border bg-muted/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) { moveStage.mutate({ id: dragId, stage: s.id }); setDragId(null); } }}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</span>
                <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">{list.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                {list.map((a) => (
                  <CandidateCard
                    key={a.id}
                    app={a}
                    onDragStart={() => setDragId(a.id)}
                    onAnalyze={() => runAnalyze.mutate(a.id)}
                    analyzing={runAnalyze.isPending && runAnalyze.variables === a.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateCard({ app, onDragStart, onAnalyze, analyzing }: { app: AppRow; onDragStart: () => void; onAnalyze: () => void; analyzing: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onClick={() => setOpen(true)}
        className="cursor-grab rounded-md border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 active:cursor-grabbing"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-medium">{app.candidate.full_name}</div>
            <div className="text-xs text-muted-foreground">{app.candidate.email}</div>
          </div>
          {app.match_score != null && <ScoreChip score={app.match_score} />}
        </div>
        {app.candidate.parsed_skills?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {app.candidate.parsed_skills.slice(0, 4).map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      <CandidateDialog open={open} onOpenChange={setOpen} app={app} onAnalyze={onAnalyze} analyzing={analyzing} />
    </>
  );
}

function ScoreChip({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-primary/10 text-primary border-primary/20" : score >= 50 ? "bg-accent text-accent-foreground border-border" : "bg-muted text-muted-foreground border-border";
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>{score}</span>;
}

function CandidateDialog({ open, onOpenChange, app, onAnalyze, analyzing }: { open: boolean; onOpenChange: (v: boolean) => void; app: AppRow; onAnalyze: () => void; analyzing: boolean }) {
  const qc = useQueryClient();
  const [schedOpen, setSchedOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [loc, setLoc] = useState("");
  const [notes, setNotes] = useState("");

  const schedule = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("interviews").insert({
        application_id: app.id,
        scheduled_at: new Date(when).toISOString(),
        interviewer_name: interviewer || null,
        location: loc || null,
        notes: notes || null,
        created_by: u.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interview scheduled");
      setSchedOpen(false);
      setWhen(""); setInterviewer(""); setLoc(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {app.candidate.full_name}
            {app.match_score != null && <ScoreChip score={app.match_score} />}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div className="text-muted-foreground">{app.candidate.email} {app.candidate.experience_years != null && `· ${app.candidate.experience_years} yrs exp`}</div>
          {app.match_summary && (
            <div className="rounded-md border border-border bg-accent/40 p-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">AI assessment</div>
              <p>{app.match_summary}</p>
              {(app.matched_skills?.length || app.missing_skills?.length) ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Matched</p>
                    <div className="mt-1 flex flex-wrap gap-1">{app.matched_skills?.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Missing</p>
                    <div className="mt-1 flex flex-wrap gap-1">{app.missing_skills?.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {app.candidate.summary && <p>{app.candidate.summary}</p>}
          {app.candidate.parsed_skills?.length ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills</p>
              <div className="mt-1 flex flex-wrap gap-1">{app.candidate.parsed_skills.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
            </div>
          ) : null}
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">Resume</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{app.candidate.resume_text}</pre>
          </details>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            {app.match_score != null ? "Re-run AI" : "Run AI screening"}
          </Button>
          <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
            <DialogTrigger asChild>
              <Button><CalendarPlus className="mr-1 h-4 w-4" /> Schedule interview</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule interview</DialogTitle></DialogHeader>
              <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); schedule.mutate(); }}>
                <div className="grid gap-1.5"><Label>When</Label><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Interviewer</Label><Input maxLength={120} value={interviewer} onChange={(e) => setInterviewer(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Location / link</Label><Input maxLength={300} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Zoom URL, office…" /></div>
                <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={schedule.isPending}>{schedule.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}