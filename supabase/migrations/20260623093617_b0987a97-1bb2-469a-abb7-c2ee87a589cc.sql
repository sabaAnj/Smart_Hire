
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "No user role inserts" ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No user role updates" ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No user role deletes" ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
