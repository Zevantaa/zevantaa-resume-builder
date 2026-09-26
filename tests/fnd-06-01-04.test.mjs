import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mockModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const modules = {
      "server-only": "export {}",
      "@/features/authentication/authorization":
        "export async function requireApplicationRole(role){return globalThis.__contactQa.requireRole(role)}",
      "@/lib/supabase/admin":
        "export function createSupabaseAdminClient(){return globalThis.__contactQa.adminClient}",
      "@/lib/supabase/server":
        "export async function createServerSupabaseClient(){return globalThis.__contactQa.sessionClient}",
    };

    if (specifier in modules) {
      return { url: mockModule(modules[specifier]), shortCircuit: true };
    }

    if (
      specifier === "./contact-profile-service" &&
      context.parentURL?.endsWith("save-contact-profile-action.ts")
    ) {
      return {
        url: mockModule(
          "export async function saveClientContactProfile(values){return globalThis.__contactQa.save(values)}",
        ),
        shortCircuit: true,
      };
    }

    if (
      specifier.startsWith("./") &&
      context.parentURL?.endsWith(".ts") &&
      !/\.[cm]?[jt]s$/.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }

    return nextResolve(specifier, context);
  },
});

const { validateContactProfile } = await import(
  "../src/features/client-portal/contact-profile-validation.ts"
);
const { getClientContactProfile, saveClientContactProfile } = await import(
  "../src/features/client-portal/contact-profile-service.ts"
);
const { saveContactProfileAction } = await import(
  "../src/features/client-portal/save-contact-profile-action.ts"
);

const profileId = "11111111-1111-4111-8111-111111111111";
const otherProfileId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

function validInput(overrides = {}) {
  return {
    fullName: "  Fictional   Candidate  ",
    primaryEmail: "  CANDIDATE@EXAMPLE.INVALID  ",
    mobileNumber: " +91 (98765) 43210 ",
    whatsappNumber: " +44 7700-900123 ",
    sameAsMobile: false,
    ...overrides,
  };
}

function form(input) {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) {
    data.set(key, String(value));
  }
  return data;
}

function setup() {
  const profiles = new Map([
    [profileId, {
      id: profileId,
      full_name: "Fictional Candidate",
      primary_email: "candidate@example.invalid",
      mobile_number: "+919876543210",
      whatsapp_number: null,
      archived_at: null,
    }],
    [otherProfileId, {
      id: otherProfileId,
      full_name: "Another Fictional Candidate",
      primary_email: "other@example.invalid",
      mobile_number: "+447700900999",
      whatsapp_number: null,
      archived_at: null,
    }],
  ]);
  let selectedProfileId = null;
  let updateValues = null;
  const state = {
    profiles,
    linkedProfileId: profileId,
    currentRole: "client",
    writes: 0,
    savedActionValues: null,
  };

  globalThis.__contactQa = {
    async requireRole(role) {
      if (role !== "client" || state.currentRole !== "client") {
        throw new Error("access denied");
      }
      return { userId };
    },
    sessionClient: {
      from(table) {
        assert.equal(table, "user_roles");
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return {
              data: { candidate_profile_id: state.linkedProfileId },
              error: null,
            };
          },
        };
      },
    },
    adminClient: {
      from(table) {
        assert.equal(table, "candidate_profiles");
        selectedProfileId = null;
        updateValues = null;
        return {
          select() { return this; },
          eq(key, value) {
            if (key === "id") selectedProfileId = value;
            return this;
          },
          is() { return this; },
          update(values) { updateValues = values; return this; },
          async maybeSingle() {
            const profile = profiles.get(selectedProfileId);
            if (!profile) return { data: null, error: null };
            if (updateValues) {
              state.writes += 1;
              Object.assign(profile, updateValues);
              return { data: { id: profile.id }, error: null };
            }
            return { data: profile, error: null };
          },
        };
      },
    },
    async save(values) {
      state.savedActionValues = values;
      return "saved";
    },
  };

  return state;
}

test("name, contact email and international numbers normalize conservatively", () => {
  const { errors, values } = validateContactProfile(validInput());
  assert.deepEqual(errors, {});
  assert.deepEqual(values, {
    fullName: "Fictional Candidate",
    primaryEmail: "candidate@example.invalid",
    mobileNumber: "+919876543210",
    whatsappNumber: "+447700900123",
  });
});

test("optional WhatsApp and same-as-mobile behavior", () => {
  assert.equal(
    validateContactProfile(validInput({ whatsappNumber: "", sameAsMobile: false }))
      .values.whatsappNumber,
    null,
  );
  const same = validateContactProfile(
    validInput({ whatsappNumber: "ignored", sameAsMobile: true }),
  );
  assert.deepEqual(same.errors, {});
  assert.equal(same.values.whatsappNumber, same.values.mobileNumber);
});

test("required and malformed fields are rejected", () => {
  const { errors } = validateContactProfile(validInput({
    fullName: " ",
    primaryEmail: "not-an-email",
    mobileNumber: "+91 123",
    whatsappNumber: "+44 ABCD",
  }));
  assert.deepEqual(Object.keys(errors).sort(), [
    "fullName", "mobileNumber", "primaryEmail", "whatsappNumber",
  ]);
  assert.ok(validateContactProfile(validInput({ mobileNumber: "+0000000000" })).errors.mobileNumber);
});

test("load and save use only the authenticated client's linked profile", async () => {
  const state = setup();
  const loaded = await getClientContactProfile();
  assert.equal(loaded.primaryEmail, "candidate@example.invalid");
  const result = await saveClientContactProfile(
    validateContactProfile(validInput()).values,
  );
  assert.equal(result, "saved");
  assert.equal(state.writes, 1);
  assert.equal(state.profiles.get(profileId).primary_email, "candidate@example.invalid");
  assert.equal(state.profiles.get(otherProfileId).primary_email, "other@example.invalid");
  assert.equal(state.profiles.get(profileId).mobile_number, "+919876543210");
});

test("unlinked and non-client callers cannot update another profile", async () => {
  const state = setup();
  state.linkedProfileId = null;
  assert.equal(
    await saveClientContactProfile(validateContactProfile(validInput()).values),
    "missing",
  );
  assert.equal(state.writes, 0);
  state.currentRole = "admin";
  await assert.rejects(() => getClientContactProfile(), /access denied/);
  await assert.rejects(
    () => saveClientContactProfile(validateContactProfile(validInput()).values),
    /access denied/,
  );
  assert.equal(state.writes, 0);
});

test("server action validates input and sends only the four contact fields", async () => {
  const state = setup();
  const invalid = await saveContactProfileAction({ status: "idle" }, form({
    fullName: "X",
    primaryEmail: "bad",
    mobileNumber: "12",
    whatsappNumber: "",
  }));
  assert.equal(invalid.status, "error");
  assert.equal(state.savedActionValues, null);

  const valid = await saveContactProfileAction({ status: "idle" }, form({
    ...validInput(),
    sameAsMobile: "on",
    candidateProfileId: otherProfileId,
  }));
  assert.equal(valid.status, "success");
  assert.deepEqual(Object.keys(state.savedActionValues).sort(), [
    "fullName", "mobileNumber", "primaryEmail", "whatsappNumber",
  ]);
  assert.equal(state.savedActionValues.whatsappNumber, "+919876543210");
});
