import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RegionalIntake } from "@/types/regional-intake";

import { getCurrentClientCareerProfile } from "./career-profile-service";
import { resolveLinkedClientProfile } from "./contact-profile-service";
import { validateRegionalIntake } from "./regional-intake-validation";

export type RegionalSaveResult = "saved" | "stale" | "missing";

/** A single linked client can update only their own regional facts at the expected revision. */
export async function saveCurrentClientRegionalIntake(value: unknown, revision: number): Promise<RegionalSaveResult> {
  const intake: RegionalIntake = validateRegionalIntake(value);
  const linked = await resolveLinkedClientProfile();
  if (!linked) return "missing";
  const snapshot = await getCurrentClientCareerProfile();
  if (!snapshot || snapshot.profile.id !== linked.profileId) return "missing";
  if (snapshot.revision !== revision) return "stale";
  const educationIds = new Set(snapshot.profile.education.map((item) => item.id));
  if (intake.eu?.eqf?.some((item) => !educationIds.has(item.educationId))) {
    throw new Error("An EQF entry must refer to a current qualification in your profile.");
  }
  const { data, error } = await createSupabaseAdminClient().rpc("apply_client_regional_intake_v1", {
    p_profile_id: linked.profileId, p_actor_id: linked.userId,
    p_expected_revision: revision, p_payload: intake,
  });
  if (error) throw new Error("Regional details could not be saved. Refresh and try again.");
  if (data === null) return "stale";
  if (!Number.isSafeInteger(data)) throw new Error("Regional save could not be confirmed.");
  return "saved";
}
