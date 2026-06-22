import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile — Hireflow" }] }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");

  const { data: profile, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    enabled: !!user,
    queryKey: ["roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role);
    },
  });

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <UserCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile?.full_name || user?.email?.split("@")[0] || "Your profile"}
          </h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
            ))}
          </div>
        </div>
      </div>

      <form
        className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        <h2 className="text-lg font-medium">Account details</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            value={fullName}
            maxLength={120}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="grid gap-1.5">
          <Label>Member since</Label>
          <Input
            value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ""}
            disabled
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending || isLoading}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}