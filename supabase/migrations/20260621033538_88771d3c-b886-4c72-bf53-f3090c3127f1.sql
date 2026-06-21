
-- has_role is only ever called for auth.uid(), and user_roles RLS lets users read their own roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Tighten candidate inserts: require non-empty name+email; authenticated inserts require recruiter role.
DROP POLICY IF EXISTS "Anyone can submit candidate" ON public.candidates;
DROP POLICY IF EXISTS "Authed can submit candidate" ON public.candidates;
CREATE POLICY "Anon submits candidate" ON public.candidates FOR INSERT TO anon
  WITH CHECK (length(full_name) > 0 AND length(email) > 0);
CREATE POLICY "Recruiters add candidate" ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));

-- Tighten authenticated application insert to recruiter role.
DROP POLICY IF EXISTS "Authed applies" ON public.applications;
CREATE POLICY "Recruiters add app" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));
