"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";

import type { ContactProfileActionState } from "./contact-profile-types";

export async function saveContactProfileAction(
  _previousState: ContactProfileActionState,
  _formData: FormData,
): Promise<ContactProfileActionState> {
  void _previousState;
  void _formData;
  // Server Actions are callable independently of the route that renders them.
  await requireApplicationRole("client");

  return { message: "Contact details are managed by Zevantaa administrators.", status: "error" };
}
