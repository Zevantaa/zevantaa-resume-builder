import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  RelocationPreference,
  TargetMarket,
  V1PackageCode,
} from "@/types/client-profile";

import { resolveLinkedClientProfile } from "./contact-profile-service";

export type ClientPackageOption = {
  code: V1PackageCode;
  displayName: string;
  isActive: boolean;
  targetMarkets: readonly TargetMarket[];
};

export type ClientProfileDetails = {
  linkedinUrl: string;
  currentLocation: string;
  relocationPreference: RelocationPreference;
  selectedPackageCode: V1PackageCode;
  packages: readonly ClientPackageOption[];
};

export async function getClientProfileDetails(): Promise<ClientProfileDetails | null> {
  const linked = await resolveLinkedClientProfile();
  if (!linked) return null;

  const supabase = createSupabaseAdminClient();
  const [profileResult, packageResult] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("linkedin_url, current_location, relocation_preference, selected_package_code")
      .eq("id", linked.profileId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("package_definitions")
      .select("code, display_name, target_markets, is_active, archived_at")
      .order("sort_order"),
  ]);

  if (profileResult.error || packageResult.error) {
    throw new Error("The intake details could not be loaded.");
  }
  if (!profileResult.data) return null;

  return {
    linkedinUrl: profileResult.data.linkedin_url ?? "",
    currentLocation: profileResult.data.current_location,
    relocationPreference: profileResult.data.relocation_preference as RelocationPreference,
    selectedPackageCode: profileResult.data.selected_package_code as V1PackageCode,
    packages: (packageResult.data ?? []).map((definition) => ({
      code: definition.code as V1PackageCode,
      displayName: definition.display_name,
      isActive: definition.is_active && definition.archived_at === null,
      targetMarkets: definition.target_markets as TargetMarket[],
    })),
  };
}
