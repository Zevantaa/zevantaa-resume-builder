import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveLinkedClientProfile } from "./contact-profile-service";

/** Search names server-side; the private table never grants browser reads. */
export async function getCurrentClientSkillLibrary(): Promise<string[]> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return [];
  const { data, error } = await createSupabaseAdminClient().from("skill_library")
    .select("canonical_name").order("canonical_name").limit(500);
  if (error) throw new Error("The skill library could not be loaded.");
  return (data ?? []).map((row) => row.canonical_name);
}
