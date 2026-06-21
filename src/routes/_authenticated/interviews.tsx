import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/interviews")({
  head: () => ({ meta: [{ title: "Interviews — Hireflow" }] }),
  component: Interviews,
});

function Interviews() {
  const { data: rows = [] } = useQuery({
    queryKey: ["interviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("id, scheduled_at, interviewer_name, location, notes, application:applications(id, job:jobs(title), candidate:candidates(full_name, email))")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
      <div className="mt-6 grid gap-2">
        {rows.map((r) => {
          const app = r.application as unknown as { candidate: { full_name: string; email: string }; job: { title: string } } | null;
          return (
            <div key={r.id} className="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><CalendarClock className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{app?.candidate.full_name ?? "Candidate"} <span className="text-muted-foreground font-normal">· {app?.job.title}</span></div>
                  <div className="text-sm text-muted-foreground">{new Date(r.scheduled_at).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.interviewer_name && <>Interviewer: {r.interviewer_name} · </>}
                  {r.location && <>{r.location}</>}
                </div>
                {r.notes && <p className="mt-2 text-sm">{r.notes}</p>}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No interviews scheduled yet.</div>}
      </div>
    </div>
  );
}