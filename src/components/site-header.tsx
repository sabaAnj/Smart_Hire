import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </span>
          <span>Hireflow</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            Jobs
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Dashboard
              </Link>
              <Link to="/candidates" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Candidates
              </Link>
              <Link to="/interviews" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                Interviews
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await signOut();
                  router.navigate({ to: "/" });
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Recruiter sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}