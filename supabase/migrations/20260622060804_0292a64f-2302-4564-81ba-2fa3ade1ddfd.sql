ALTER TABLE public.jobs ALTER COLUMN created_by DROP NOT NULL;

INSERT INTO public.jobs (title, description, location, employment_type, required_skills, status)
VALUES
  ('Senior Frontend Engineer', 'Build delightful user interfaces with React and TypeScript. Collaborate with design and product to ship high-quality features.', 'Remote', 'full_time', ARRAY['React','TypeScript','CSS','Testing'], 'published'),
  ('Product Designer', 'Lead design for our core product. Own discovery, prototyping, and visual design end-to-end.', 'New York, NY', 'full_time', ARRAY['Figma','Prototyping','User research'], 'published'),
  ('Backend Engineer (Node.js)', 'Design and ship reliable APIs and data pipelines. Strong focus on observability and performance.', 'Remote', 'full_time', ARRAY['Node.js','PostgreSQL','AWS'], 'published'),
  ('Marketing Intern', 'Support content, social, and campaign analytics. Great for students exploring B2B marketing.', 'Austin, TX', 'internship', ARRAY['Writing','Analytics'], 'published'),
  ('DevOps Contractor', '3-month engagement to harden our CI/CD and Kubernetes setup.', 'Remote', 'contract', ARRAY['Kubernetes','Terraform','GitHub Actions'], 'published'),
  ('Customer Success Manager', 'Own onboarding and retention for our enterprise accounts.', 'London, UK', 'full_time', ARRAY['SaaS','Onboarding','Account management'], 'published');