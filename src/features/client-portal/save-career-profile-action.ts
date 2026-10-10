"use server";

import { revalidatePath } from "next/cache";

import { requireApplicationRole } from "@/features/authentication/authorization";

import { saveCurrentClientCareerProfile } from "./career-profile-service";
import { CareerValidationError, validateCareerDraft } from "./career-profile-validation";

export type CareerActionState = { status: "idle" | "success" | "error" | "stale"; message: string; savedAt?: number };

export async function saveCareerProfileAction(_previous: CareerActionState, formData: FormData): Promise<CareerActionState> {
  await requireApplicationRole("client");
  if ([...formData.keys()].some((key) => key !== "careerData" && key !== "revision")) {
    return { status: "error", message: "This form contains a field that cannot be changed here. Refresh and try again." };
  }
  const raw = formData.get("careerData");
  const revision = Number(formData.get("revision"));
  if (typeof raw !== "string" || raw.length > 250_000 || !Number.isSafeInteger(revision) || revision < 0) {
    return { status: "error", message: "The career form is invalid. Refresh and try again." };
  }
  try {
    const validated = validateCareerDraft(JSON.parse(raw));
    const result = await saveCurrentClientCareerProfile(validated, revision);
    if (result === "stale") return { status: "stale", message: "Your profile changed since this page was opened. Refresh and review the latest information before saving again." };
    if (result === "missing") return { status: "error", message: "Your linked profile is unavailable. Contact Zevantaa support." };
    revalidatePath("/client", "layout");
    revalidatePath("/admin", "layout");
    return { status: "success", message: "Your career updates were saved. Your ATS indicator and the next fresh PDF will use the updated facts.", savedAt: Date.now() };
  } catch (error) {
    if (error instanceof CareerValidationError || error instanceof SyntaxError) {
      return { status: "error", message: error instanceof CareerValidationError ? error.message : "The career form is invalid. Refresh and try again." };
    }
    return { status: "error", message: "Your career changes could not be saved. Refresh and try again; no partial update was accepted." };
  }
}
