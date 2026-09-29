"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";

import type { ProfileDetailsActionState } from "./profile-details-types";

export async function saveProfileDetailsAction(
  _previousState: ProfileDetailsActionState,
  _formData: FormData,
): Promise<ProfileDetailsActionState> {
  void _previousState;
  void _formData;
  // A Server Action can be invoked without rendering its protected page first.
  await requireApplicationRole("client");

  return { message: "Professional link and mobility details are managed by Zevantaa administrators.", status: "error" };
}
