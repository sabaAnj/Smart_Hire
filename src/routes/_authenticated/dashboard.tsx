import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Briefcase, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Hireflow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, status, location, employment_type, created_at, required_skills")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [{ count: candCount }, { count: appCount }, { count: intCount }] = await Promise.all([
        supabase.from("candidates").select("*", { count: "exact", head: true }),
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("interviews").select("*", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString()),
      ]);
      return { candidates: candCount ?? 0, applications: appCount ?? 0, upcomingInterviews: intCount ?? 0 };
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your hiring overview.</p>
        </div>
        <Button asChild>
          <Link to="/jobs/new"><Plus className="mr-1 h-4 w-4" /> New job</Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Active jobs" value={jobs.filter((j) => j.status === "published").length} icon={<Briefcase className="h-4 w-4" />} />
        <Stat label="Candidates" value={stats?.candidates ?? 0} icon={<Users className="h-4 w-4" />} />
        <Stat label="Upcoming interviews" value={stats?.upcomingInterviews ?? 0} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="font-medium">All jobs</h2>
        </div>
        <div className="divide-y divide-border">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No jobs yet. Create your first one.</div>
          ) : jobs.map((j) => (
            <Link key={j.id} to="/jobs/$jobId/pipeline" params={{ jobId: j.id }} className="flex items-center justify-between p-4 transition hover:bg-muted/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{j.title}</span>
                  <StatusBadge status={j.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {j.location ? `${j.location} · ` : ""}{j.employment_type.replace("_", " ")}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {j.required_skills?.slice(0, 3).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-primary/10 text-primary border-primary/20",
    draft: "bg-muted text-muted-foreground border-border",
    closed: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] capitalize ${map[status] ?? map.draft}`}>{status}</span>;
}