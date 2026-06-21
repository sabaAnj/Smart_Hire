import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Hireflow" }] }),
  component: Candidates,
});

function Candidates() {
  const { data: cands = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, full_name, email, parsed_skills, experience_years, summary, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
      <p className="text-sm text-muted-foreground">{cands.length} total</p>
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Experience</th><th className="p-3">Top skills</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cands.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{c.full_name}</td>
                <td className="p-3 text-muted-foreground">{c.email}</td>
                <td className="p-3 text-muted-foreground">{c.experience_years != null ? `${c.experience_years} yrs` : "—"}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{(c.parsed_skills ?? []).slice(0, 5).map((s) => <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>)}</div></td>
              </tr>
            ))}
            {cands.length === 0 && <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>No candidates yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}