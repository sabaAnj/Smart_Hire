import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Hireflow" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/profile" });
  }, [user, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Welcome back!");
      navigate({ to: "/profile" });
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Account created — welcome to Hireflow!");
      navigate({ to: "/profile" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold tracking-tight">Recruiter access</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to manage jobs, candidates, and interviews.</p>
          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form className="mt-4 grid gap-4" onSubmit={signIn}>
                <Field label="Email" id="si-email" type="email" value={email} onChange={setEmail} />
                <Field label="Password" id="si-pw" type="password" value={password} onChange={setPassword} />
                <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form className="mt-4 grid gap-4" onSubmit={signUp}>
                <Field label="Full name" id="su-name" value={fullName} onChange={setFullName} />
                <Field label="Email" id="su-email" type="email" value={email} onChange={setEmail} />
                <Field label="Password" id="su-pw" type="password" value={password} onChange={setPassword} />
                <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, type = "text", value, onChange }: { label: string; id: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} required value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}