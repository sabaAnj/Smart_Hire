import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({
  applicationId: z.string().uuid(),
});

/**
 * Reads the candidate's resume + the job's required skills/description,
 * uses Lovable AI to extract skills + score the match, and writes the
 * results back to the candidate + application rows.
 */
export const analyzeApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, job_id, candidate_id")
      .eq("id", data.applicationId)
      .single();
    if (appErr || !app) throw new Error("Application not found");

    const [{ data: job }, { data: cand }] = await Promise.all([
      supabase.from("jobs").select("title, description, required_skills").eq("id", app.job_id).single(),
      supabase.from("candidates").select("full_name, resume_text").eq("id", app.candidate_id).single(),
    ]);
    if (!job || !cand) throw new Error("Missing job or candidate");

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const schema = z.object({
      parsed_skills: z.array(z.string()).max(40),
      experience_years: z.number().min(0).max(60),
      summary: z.string().max(600),
      match_score: z.number().int().min(0).max(100),
      match_summary: z.string().max(600),
      matched_skills: z.array(z.string()).max(30),
      missing_skills: z.array(z.string()).max(30),
    });

    const prompt = `You are an expert technical recruiter. Analyze the candidate's resume against the job and return ONLY JSON matching the schema.

JOB TITLE: ${job.title}
JOB DESCRIPTION:
${job.description}
REQUIRED SKILLS: ${(job.required_skills ?? []).join(", ") || "(none specified)"}

CANDIDATE: ${cand.full_name}
RESUME:
${(cand.resume_text || "").slice(0, 12000)}

Tasks:
1. parsed_skills: extract distinct technical/professional skills from the resume.
2. experience_years: estimate total years of relevant experience (number).
3. summary: 2-3 sentence neutral summary of the candidate.
4. match_score: 0-100 fit score based on required skills + relevance.
5. match_summary: 2-3 sentence justification.
6. matched_skills / missing_skills: required skills found / not found in the resume.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema }),
      prompt,
    });

    const out = experimental_output;

    await supabase.from("candidates").update({
      parsed_skills: out.parsed_skills,
      experience_years: out.experience_years,
      summary: out.summary,
    }).eq("id", app.candidate_id);

    await supabase.from("applications").update({
      match_score: out.match_score,
      match_summary: out.match_summary,
      matched_skills: out.matched_skills,
      missing_skills: out.missing_skills,
    }).eq("id", app.id);

    return { ok: true, ...out };
  });