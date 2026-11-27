"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { processDocumentRegenerationJobs } from "@/features/document-generation/document-regeneration-service";

import { resolveLinkedClientProfile } from "./contact-profile-service";
import { RegionalIntakeValidationError } from "./regional-intake-validation";
import { saveCurrentClientRegionalIntake } from "./regional-intake-service";

export type RegionalActionState = { status: "idle" | "success" | "error" | "stale"; message: string; savedAt?: number };

export async function saveRegionalIntakeAction(_previous: RegionalActionState, form: FormData): Promise<RegionalActionState> {
  const actor = await requireApplicationRole("client");
  if ([...form.keys()].some((key) => key !== "regionalData" && key !== "revision")) {
    return { status: "error", message: "This form contains an unsupported field." };
  }
  const raw = form.get("regionalData");
  const revision = Number(form.get("revision"));
  if (typeof raw !== "string" || raw.length > 40_000 || !Number.isSafeInteger(revision) || revision < 0) {
    return { status: "error", message: "Regional details are invalid. Refresh and try again." };
  }
  try {
    if (process.env.NODE_ENV === "production") {
      await (await import("@/lib/security/rate-limit")).enforceRateLimit("career-save", actor.userId!, 40);
    }
    const result = await saveCurrentClientRegionalIntake(JSON.parse(raw), revision);
    if (result === "stale") return { status: "stale", message: "Your profile changed. Refresh and review the latest facts before saving." };
    if (result === "missing") return { status: "error", message: "Your linked profile is unavailable. Contact Zevantaa support." };
    try {
      const linked = await resolveLinkedClientProfile();
      if (linked) after(async () => {
        try { await processDocumentRegenerationJobs(linked.profileId, actor.userId!, 1); }
        catch { /* Durable jobs remain queued for the worker. */ }
      });
    } catch { /* The committed regional facts remain authoritative. */ }
    revalidatePath("/client", "layout");
    revalidatePath("/admin", "layout");
    return { status: "success", message: "Verified regional details saved. Entitled documents will update automatically.", savedAt: Date.now() };
  } catch (error) {
    if (error instanceof RegionalIntakeValidationError || error instanceof SyntaxError) {
      return { status: "error", message: error instanceof RegionalIntakeValidationError ? error.message : "Regional details are invalid." };
    }
    return { status: "error", message: "Regional details could not be saved. Refresh and try again." };
  }
}
