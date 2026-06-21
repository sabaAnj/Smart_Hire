
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter');
CREATE TYPE public.pipeline_stage AS ENUM ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');
CREATE TYPE public.job_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'internship');

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- New user trigger: create profile + grant recruiter role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'recruiter');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Jobs
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT,
  employment_type employment_type NOT NULL DEFAULT 'full_time',
  status job_status NOT NULL DEFAULT 'draft',
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published jobs" ON public.jobs FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Recruiters read all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')) AND created_by = auth.uid());
CREATE POLICY "Recruiters update jobs" ON public.jobs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters delete jobs" ON public.jobs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_text TEXT NOT NULL DEFAULT '',
  parsed_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years NUMERIC,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.candidates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit candidate" ON public.candidates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authed can submit candidate" ON public.candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Recruiters read candidates" ON public.candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters update candidates" ON public.candidates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  stage pipeline_stage NOT NULL DEFAULT 'applied',
  match_score INTEGER,
  match_summary TEXT,
  matched_skills TEXT[] NOT NULL DEFAULT '{}',
  missing_skills TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
GRANT INSERT ON public.applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone applies to published job" ON public.applications FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.status = 'published'));
CREATE POLICY "Authed applies" ON public.applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Recruiters read apps" ON public.applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters update apps" ON public.applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters delete apps" ON public.applications FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX applications_job_idx ON public.applications(job_id);
CREATE INDEX applications_candidate_idx ON public.applications(candidate_id);

-- Interviews
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  interviewer_name TEXT,
  location TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage interviews" ON public.interviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX interviews_app_idx ON public.interviews(application_id);
