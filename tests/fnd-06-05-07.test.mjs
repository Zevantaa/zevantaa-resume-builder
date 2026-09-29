import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const mockModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const modules = {
      "server-only": "export {}",
      "@/features/authentication/authorization":
        "export async function requireApplicationRole(role){return globalThis.__detailsQa.requireRole(role)}",
      "@/lib/supabase/admin":
        "export function createSupabaseAdminClient(){return globalThis.__detailsQa.adminClient}",
    };
    if (specifier in modules) {
      return { url: mockModule(modules[specifier]), shortCircuit: true };
    }
    if (
      specifier === "./contact-profile-service" &&
      context.parentURL?.endsWith("profile-details-service.ts")
    ) {
      return {
        url: mockModule(
          "export async function resolveLinkedClientProfile(){return globalThis.__detailsQa.linked()}",
        ),
        shortCircuit: true,
      };
    }
    if (
      specifier === "./profile-details-service" &&
      context.parentURL?.endsWith("save-profile-details-action.ts")
    ) {
      return {
        url: mockModule(
          "export async function saveClientProfileDetails(values){return globalThis.__detailsQa.save(values)}",
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

const { validateProfileDetails } = await import(
  "../src/features/client-portal/profile-details-validation.ts"
);
const { getClientProfileDetails } = await import(
  "../src/features/client-portal/profile-details-service.ts"
);
const { saveProfileDetailsAction } = await import(
  "../src/features/client-portal/save-profile-details-action.ts"
);

const profileId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const packageCodes = [
  "indian-domestic",
  "gcc-middle-east",
  "europass-european-union",
  "domestic-gcc",
  "domestic-europass-european-union",
  "global-mobility-master",
  "executive-transition-agency-distribution",
];

function validInput(overrides = {}) {
  return {
    linkedinUrl: "linkedin.com/in/fictional-candidate/?trk=profile",
    currentLocation: "  Kolkata,   India  ",
    relocationPreference: "conditional",
    ...overrides,
  };
}

function form(input) {
  const data = new FormData();
  for (const [key, value] of Object.entries(input)) data.set(key, String(value));
  return data;
}

function setup() {
  const profiles = new Map([
    [profileId, {
      id: profileId,
      linkedin_url: null,
      current_location: "Kolkata, India",
      relocation_preference: "not-specified",
      selected_package_code: "indian-domestic",
    }],
    [otherId, {
      id: otherId,
      linkedin_url: "https://www.linkedin.com/in/another-candidate",
      current_location: "Pune, India",
      relocation_preference: "open",
      selected_package_code: "gcc-middle-east",
    }],
  ]);
  const packages = packageCodes.map((code, index) => ({
    code,
    display_name: `Package ${index + 1}`,
    target_markets: index === 1 ? ["gcc-middle-east"] : ["indian-domestic"],
    is_active: index !== 6,
    archived_at: null,
  }));
  const state = {
    profiles,
    packages,
    linkedProfileId: profileId,
    role: "client",
    writes: 0,
    lastWrite: null,
  };

  globalThis.__detailsQa = {
    async requireRole(role) {
      if (role !== "client" || state.role !== "client") throw new Error("access denied");
      return { userId };
    },
    async linked() {
      if (state.role !== "client") throw new Error("access denied");
      return state.linkedProfileId ? { profileId: state.linkedProfileId, userId } : null;
    },
    adminClient: {
      from(table) {
        let selectedId = null;
        let updateValues = null;
        return {
          select() { return this; },
          eq(column, value) {
            if (column === "id") selectedId = value;
            return this;
          },
          is() { return this; },
          update(values) { updateValues = values; return this; },
          order(column) {
            assert.equal(table, "package_definitions");
            assert.equal(column, "sort_order");
            return Promise.resolve({ data: packages, error: null });
          },
          async maybeSingle() {
            assert.equal(table, "candidate_profiles");
            const profile = profiles.get(selectedId);
            if (!profile) return { data: null, error: null };
            if (updateValues) {
              state.writes += 1;
              state.lastWrite = updateValues;
              Object.assign(profile, updateValues);
              return { data: { id: profile.id }, error: null };
            }
            return { data: profile, error: null };
          },
        };
      },
    },
    async save(values) {
      state.writes += 1;
      state.lastWrite = values;
      return "saved";
    },
  };
  return state;
}

test("normal LinkedIn profile URLs are normalized without tracking parameters", () => {
  const result = validateProfileDetails(validInput());
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.linkedinUrl, "https://linkedin.com/in/fictional-candidate");
  assert.equal(result.values.currentLocation, "Kolkata, India");
  assert.equal(result.values.relocationPreference, "conditional");
  assert.equal(
    validateProfileDetails(validInput({ linkedinUrl: "https://www.linkedin.com/pub/example/12/345/678" })).values.linkedinUrl,
    "https://www.linkedin.com/pub/example/12/345/678",
  );
  assert.equal(validateProfileDetails(validInput({ linkedinUrl: "" })).values.linkedinUrl, null);
});

test("non-LinkedIn and malformed profile URLs are rejected", () => {
  for (const linkedinUrl of [
    "https://example.com/in/person",
    "https://linkedin.com.evil.invalid/in/person",
    "https://www.linkedin.com/company/example",
    "https://www.linkedin.com/in/",
    "ftp://linkedin.com/in/person",
    "https://user:pass@linkedin.com/in/person",
  ]) {
    assert.ok(validateProfileDetails(validInput({ linkedinUrl })).errors.linkedinUrl);
  }
});

test("location and relocation values are required and controlled", () => {
  const invalid = validateProfileDetails(validInput({
    currentLocation: " ",
    relocationPreference: "international-anywhere",
  }));
  assert.ok(invalid.errors.currentLocation);
  assert.ok(invalid.errors.relocationPreference);
  for (const relocationPreference of ["open", "not-open", "conditional", "not-specified"]) {
    assert.deepEqual(validateProfileDetails(validInput({ relocationPreference })).errors, {});
  }
});

test("profile details load with all seven database package definitions", async () => {
  const state = setup();
  const details = await getClientProfileDetails();
  assert.equal(details.currentLocation, "Kolkata, India");
  assert.equal(details.relocationPreference, "not-specified");
  assert.equal(details.selectedPackageCode, "indian-domestic");
  assert.deepEqual(details.packages.map((option) => option.code), packageCodes);
  assert.equal(details.packages[6].isActive, false);
  assert.equal(state.writes, 0);
});

test("linked client sees professional link and mobility without writing", async () => {
  const state = setup();
  const details = await getClientProfileDetails();
  assert.equal(details.linkedinUrl, "");
  assert.equal(state.writes, 0);
  assert.equal(state.profiles.get(profileId).current_location, "Kolkata, India");
  assert.equal(state.profiles.get(profileId).relocation_preference, "not-specified");
  assert.equal(state.profiles.get(profileId).selected_package_code, "indian-domestic");
  assert.equal(state.profiles.get(otherId).current_location, "Pune, India");
});

test("unlinked and non-client callers cannot read another profile", async () => {
  const state = setup();
  state.linkedProfileId = null;
  assert.equal(await getClientProfileDetails(), null);
  state.role = "admin";
  await assert.rejects(() => getClientProfileDetails(), /access denied/);
  assert.equal(state.writes, 0);
});

test("client action rejects valid or invalid package changes before any write", async () => {
  const state = setup();
  for (const packageCode of ["gcc-middle-east", "not-a-package", "executive-transition-agency-distribution"]) {
    const result = await saveProfileDetailsAction({ status: "idle" }, form({
      ...validInput(),
      packageCode,
    }));
    assert.equal(result.status, "error");
    assert.match(result.message, /administrator/i);
  }
  const alternateField = await saveProfileDetailsAction({ status: "idle" }, form({
    ...validInput(),
    selectedPackage: "not-a-package",
  }));
  assert.equal(alternateField.status, "error");
  assert.equal(state.writes, 0);
});

test("legacy details action rejects direct field mutations", async () => {
  const state = setup();
  const attempted = await saveProfileDetailsAction({ status: "idle" }, form({
    ...validInput(),
    candidateProfileId: otherId,
  }));
  assert.equal(attempted.status, "error");
  assert.match(attempted.message, /administrator/i);
  assert.equal(state.writes, 0);
});
