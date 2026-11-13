import { createHash, timingSafeEqual } from "node:crypto";

import { processGlobalDocumentRegenerationJobs } from "@/features/document-generation/document-regeneration-service";
import { processDocumentAtsAssessmentJobs } from "@/features/document-generation/document-ats-assessment-service";
import { processResumeProcessingJobs } from "@/features/document-generation/resume-processing-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function authorized(request: Request): boolean {
  const expected = process.env.AUTOMATION_WORKER_SECRET?.trim();
  const supplied = request.headers.get("authorization") ?? "";
  if (!expected || expected.length < 32 || !supplied.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(expected), digest(supplied.slice(7)));
}

/** Internal Supabase-Cron target. One invocation performs only bounded work. */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let source = { completed: 0, needsInput: 0, failed: 0 };
  let documents = { completed: 0, failed: 0 };
  let assessments = { completed: 0, unavailable: 0, failed: 0 };
  let ok = true;
  try { source = await processResumeProcessingJobs(2); }
  catch { ok = false; }
  try { documents = await processGlobalDocumentRegenerationJobs(2); }
  catch { ok = false; }
  try { assessments = await processDocumentAtsAssessmentJobs(2); }
  catch { ok = false; }

  return Response.json({ ok, source, documents, assessments }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "private, no-store" },
  });
}
