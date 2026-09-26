import "server-only";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { NormalizedContactProfile } from "./contact-profile-validation";
import type { ClientContactProfile } from "./contact-profile-types";

type LinkedClientProfile = {
  profileId: string;
  userId: string;
};

export type ClientDashboardSummary = {
  fullName: string;
  primaryEmail: string;
  mobileNumber: string;
  whatsappNumber: string | null;
  packageName: string;
  targetMarkets: string[];
};

async function resolveLinkedClientProfile(): Promise<LinkedClientProfile | null> {
  const context = await requireApplicationRole("client");
  if (!context.userId) {
    return null;
  }
  const sessionClient = await createServerSupabaseClient();
  const { data: role, error } = await sessionClient
    .from("user_roles")
    .select("candidate_profile_id")
    .eq("user_id", context.userId)
    .eq("role_code", "client")
    .eq("account_status", "active")
    .maybeSingle();

  if (error || typeof role?.candidate_profile_id !== "string") {
    return null;
  }

  return { profileId: role.candidate_profile_id, userId: context.userId };
}

export async function getClientContactProfile(): Promise<
  ClientContactProfile | null
> {
  const linked = await resolveLinkedClientProfile();

  if (!linked) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select("full_name, primary_email, mobile_number, whatsapp_number")
    .eq("id", linked.profileId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("The client profile could not be loaded.");
  }

  if (!profile) {
    return null;
  }

  return {
    fullName: profile.full_name,
    primaryEmail: profile.primary_email,
    mobileNumber: profile.mobile_number,
    whatsappNumber: profile.whatsapp_number ?? "",
  };
}

export async function getClientDashboardSummary(): Promise<ClientDashboardSummary | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .select("full_name, primary_email, mobile_number, whatsapp_number, selected_package_code, target_markets")
    .eq("id", linked.profileId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("The client dashboard could not be loaded.");
  if (!profile) return null;
  const { data: definition, error: packageError } = await supabase
    .from("package_definitions")
    .select("display_name")
    .eq("code", profile.selected_package_code)
    .maybeSingle();
  if (packageError) throw new Error("The assigned package could not be loaded.");
  return {
    fullName: profile.full_name,
    primaryEmail: profile.primary_email,
    mobileNumber: profile.mobile_number,
    whatsappNumber: profile.whatsapp_number,
    packageName: definition?.display_name ?? profile.selected_package_code,
    targetMarkets: profile.target_markets,
  };
}

export async function saveClientContactProfile(
  values: NormalizedContactProfile,
): Promise<"saved" | "missing"> {
  const linked = await resolveLinkedClientProfile();

  if (!linked) {
    return "missing";
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("candidate_profiles")
    .update({
      full_name: values.fullName,
      primary_email: values.primaryEmail,
      mobile_number: values.mobileNumber,
      whatsapp_number: values.whatsappNumber,
      updated_at: new Date().toISOString(),
      updated_by_user_id: linked.userId,
    })
    .eq("id", linked.profileId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error("The client profile could not be saved.");
  }

  return profile ? "saved" : "missing";
}
