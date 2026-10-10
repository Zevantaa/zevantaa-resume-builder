import "server-only";

import { randomUUID } from "node:crypto";

import { loadCandidateProfileById } from "@/features/document-generation/admin-global-ats-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CandidateProfile } from "@/types/client-profile";

import { CAREER_SECTION_NAMES, toCareerDraft } from "./career-profile-model";
import { validateCareerDraft, type ValidatedCareer, type ValidatedRow } from "./career-profile-validation";
import { resolveLinkedClientProfile } from "./contact-profile-service";

type CareerSnapshot = { profile: CandidateProfile; revision: number };

async function readRevision(profileId: string): Promise<number | null> {
  const { data, error } = await createSupabaseAdminClient().from("candidate_profiles")
    .select("career_revision").eq("id", profileId).is("archived_at", null).maybeSingle();
  if (error) throw new Error("Career profile version could not be loaded.");
  return typeof data?.career_revision === "number" ? data.career_revision : null;
}

async function loadStableSnapshot(profileId: string): Promise<CareerSnapshot | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await readRevision(profileId);
    if (before === null) return null;
    const profile = await loadCandidateProfileById(profileId);
    const after = await readRevision(profileId);
    if (!profile || after === null) return null;
    if (before === after) return { profile, revision: after };
  }
  throw new Error("The career profile changed while loading. Refresh and try again.");
}

export async function getCurrentClientCareerProfile(): Promise<CareerSnapshot | null> {
  const linked = await resolveLinkedClientProfile();
  return linked ? loadStableSnapshot(linked.profileId) : null;
}

export type CareerSaveResult = "saved" | "stale" | "missing";

function existingIndex(key: string, length: number): number | null {
  if (key.startsWith("new-")) return null;
  const index = Number(key.slice("existing-".length));
  if (!Number.isSafeInteger(index) || index < 0 || index >= length) {
    throw new Error("Career entry changed. Refresh and try again.");
  }
  return index;
}

function payloadRows(
  rows: ValidatedRow[], originals: ValidatedRow[], ids: string[],
): Record<string, unknown>[] {
  return rows.map((row, sortOrder) => {
    const index = existingIndex(row.key, ids.length);
    const { key: _key, ...content } = row;
    const original = index === null ? null : originals.find((item) => item.key === row.key);
    const { key: _originalKey, ...originalContent } = original ?? { key: "" };
    void _key; void _originalKey;
    return { id: index === null ? randomUUID() : ids[index], sortOrder,
      changed: index === null || index !== sortOrder || JSON.stringify(content) !== JSON.stringify(originalContent),
      ...content };
  });
}

function buildPayload(validated: ValidatedCareer, profile: CandidateProfile): Record<string, unknown> {
  const original = validateCareerDraft(toCareerDraft(profile));
  const payload: Record<string, unknown> = { professionalSummary: validated.professionalSummary };
  for (const section of CAREER_SECTION_NAMES) {
    const ids = profile[section].map((row) => row.id);
    payload[section] = payloadRows(validated[section], original[section], ids);
  }
  payload.additionalSections = validated.additionalSections.map((section, sortOrder) => {
    const index = existingIndex(section.key, profile.additionalSections.length);
    const previous = index === null ? null : original.additionalSections.find((item) => item.key === section.key);
    const parent = index === null ? null : profile.additionalSections[index];
    return {
      id: parent?.id ?? randomUUID(), sortOrder, title: section.title,
      changed: index === null || index !== sortOrder || previous?.title !== section.title,
      items: payloadRows(section.items, previous?.items ?? [], parent?.items.map((item) => item.id) ?? []),
    };
  });
  return payload;
}

/** Service-role RPC is server-only; the RPC rechecks role/linkage and locks the profile. */
export async function saveCurrentClientCareerProfile(validated: ValidatedCareer, expectedRevision: number): Promise<CareerSaveResult> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return "missing";
  const snapshot = await loadStableSnapshot(linked.profileId);
  if (!snapshot) return "missing";
  if (snapshot.revision !== expectedRevision) return "stale";
  const payload = buildPayload(validated, snapshot.profile);
  const { data, error } = await createSupabaseAdminClient().rpc("apply_client_career_profile_v8", {
    p_profile_id: linked.profileId,
    p_actor_id: linked.userId,
    p_expected_revision: expectedRevision,
    p_payload: payload,
  });
  if (error) throw new Error("Your career changes could not be saved. No partial update was accepted.");
  if (data === null) return "stale";
  if (!Number.isSafeInteger(data)) throw new Error("Your career changes could not be confirmed. Refresh and check the latest profile.");
  const fresh = await loadStableSnapshot(linked.profileId);
  if (!fresh || fresh.revision < data) throw new Error("Your save could not be confirmed. Refresh and check the latest profile.");
  return "saved";
}
