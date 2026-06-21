import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { MapPin, ArrowRight, Sparkles, GitBranch, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hireflow — Open roles" },
      { name: "description", content: "Browse open roles and apply. AI-screened, fast feedback." },
      { property: "og:title", content: "Hireflow — Open roles" },
      { property: "og:description", content: "Browse open roles and apply." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, location, employment_type, required_skills, created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-4 gap-1">
              <Sparkles className="h-3 w-3" /> AI-powered ATS
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Hire faster with AI screening and a clear pipeline.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Hireflow parses resumes, scores candidates against your job description, and gives your team a visual hiring pipeline — all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Resume parsing & match score</span>
              <span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Drag-and-drop pipeline</span>
              <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-primary" /> Interview scheduling</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Open roles</h2>
            <p className="text-sm text-muted-foreground">Apply in under a minute. We'll use AI to surface the best fits to our team.</p>
          </div>
        </div>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-card" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">No open roles right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <Link
                key={j.id}
                to="/jobs/$jobId"
                params={{ jobId: j.id }}
                className="group rounded-lg border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium tracking-tight text-foreground group-hover:text-primary">{j.title}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {j.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>
                  )}
                  <span className="capitalize">{j.employment_type.replace("_", " ")}</span>
                </div>
                {j.required_skills?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {j.required_skills.slice(0, 4).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                    ))}
                    {j.required_skills.length > 4 && (
                      <Badge variant="outline" className="text-[10px] font-normal">+{j.required_skills.length - 4}</Badge>
                    )}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
