import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const emptyModule = "data:text/javascript,export%20{}";
const authorizationModule =
  "data:text/javascript,export%20async%20function%20requireApplicationRole(role)%7Breturn%20globalThis.__fnd05.requireRole(role)%7D";
const adminModule =
  "data:text/javascript,export%20function%20createSupabaseAdminClient()%7Breturn%20globalThis.__fnd05.client%7D";
const actionServiceModule =
  "data:text/javascript,export%20async%20function%20provisionClientAccount(input)%7Breturn%20globalThis.__fnd05.provision(input)%7D%3Bexport%20async%20function%20retryClientInvitation(id)%7Breturn%20globalThis.__fnd05.retry(id)%7D%3Bexport%20async%20function%20updateClientAccount(input)%7Breturn%20globalThis.__fnd05.update(input)%7D";
const mockModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: emptyModule, shortCircuit: true };
    }
    if (specifier === "@/features/authentication/authorization") {
      return { url: authorizationModule, shortCircuit: true };
    }
    if (specifier === "@/lib/supabase/admin") {
      return { url: adminModule, shortCircuit: true };
    }
    if (specifier === "@/lib/supabase/server") {
      return {
        url: mockModule("export async function createServerSupabaseClient(){return globalThis.__fnd05.serverClient}"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/supabase/client") {
      return {
        url: mockModule("export function createBrowserSupabaseClient(){return globalThis.__fnd05.browserClient}"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/supabase/config") {
      return {
        url: mockModule("export class SupabaseConfigurationError extends Error{}; export function isSupabaseConfigured(){return true}"),
        shortCircuit: true,
      };
    }
    if (specifier === "next/cache") {
      return { url: mockModule("export function revalidatePath(path){globalThis.__fnd05.revalidated.push(path)}"), shortCircuit: true };
    }
    if (specifier.startsWith("@/features/document-generation/")) {
      return nextResolve(new URL(`../src/features/document-generation/${specifier.slice("@/features/document-generation/".length)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith("@/types/")) {
      return nextResolve(new URL(`../src/types/${specifier.slice("@/types/".length)}.ts`, import.meta.url).href, context);
    }
    if (specifier === "next/navigation") {
      return {
        url: mockModule("export function redirect(path){throw new Error('REDIRECT:'+path)}"),
        shortCircuit: true,
      };
    }
    if (
      specifier === "./client-account-service" &&
      context.parentURL?.includes("-client-account-action.ts")
    ) {
      return { url: actionServiceModule, shortCircuit: true };
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.endsWith(".ts") &&
      !/\.[cm]?[jt]s$/.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { createClientAccountAction } = await import(
  "../src/features/admin-portal/create-client-account-action.ts"
);
const { editClientAccountAction } = await import(
  "../src/features/admin-portal/edit-client-account-action.ts"
);
const { provisionClientAccount, retryClientInvitation, updateClientAccount, getProvisionedClient } = await import(
  "../src/features/admin-portal/client-account-service.ts"
);
const { requireApplicationRole } = await import(
  "../src/features/authentication/authorization.ts"
);
const { signInWithPassword, signOut } = await import(
  "../src/features/authentication/auth-service.ts"
);

const candidateId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const core = {
  fullName: "Fictional Candidate",
  email: "fictional@example.invalid",
  mobileNumber: "+919876543210",
  whatsappNumber: "",
  linkedinUrl: "",
  currentLocation: "Kolkata, India",
  relocationPreference: "not-specified",
  packageCode: "indian-domestic",
};
const profile = {
  ...core,
  whatsappNumber: null,
  linkedinUrl: null,
};

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...core, ...values })) data.set(key, value);
  return data;
}

function setup() {
  const state = {
    authUsers: [],
    candidates: [
      {
        id: candidateId,
        full_name: "Fictional Candidate",
        primary_email: "fictional@example.invalid",
        mobile_number: "+919876543210",
        whatsapp_number: null,
        linkedin_url: null,
        current_location: "Kolkata, India",
        relocation_preference: "not-specified",
        selected_package_code: "indian-domestic",
        target_markets: ["indian-domestic"],
        archived_at: null,
      },
    ],
    packages: [
      {
        code: "indian-domestic",
        display_name: "Indian Domestic",
        target_markets: ["indian-domestic"],
        is_active: true,
        archived_at: null,
      },
      {
        code: "gcc-middle-east",
        display_name: "GCC / Middle East",
        target_markets: ["gcc-middle-east"],
        is_active: true,
        archived_at: null,
      },
      {
        code: "europass-european-union",
        display_name: "Europass / EU",
        target_markets: ["european-union"],
        is_active: true,
        archived_at: null,
      },
      {
        code: "executive-transition-agency-distribution",
        display_name: "Executive All-Inclusive",
        target_markets: ["indian-domestic", "gcc-middle-east", "european-union"],
        is_active: true,
        archived_at: null,
      },
    ],
    roles: [],
    invitations: [],
    authCreateCalls: 0,
    failInviteOnce: false,
    failRoleInsert: false,
    failRoleUpdate: false,
    revalidated: [],
  };

  function query(table) {
    const records =
      table === "candidate_profiles"
        ? state.candidates
        : table === "package_definitions"
          ? state.packages
          : table === "client_onboarding_invitations"
            ? state.invitations
            : state.roles;
    const filters = [];
    let updateValues;
    let insertValues;
    let insertApplied = false;
    const builder = {
      select() { return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      neq(key, value) { filters.push((row) => row[key] !== value); return this; },
      is(key, value) { filters.push((row) => row[key] === value); return this; },
      order() { return this; },
      update(values) { updateValues = values; return this; },
      insert(values) {
        if (table === "user_roles" && state.failRoleInsert) {
          return { select() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: { code: "linkage_failed" } }); }, then(resolve) { return Promise.resolve({ data: null, error: { code: "linkage_failed" } }).then(resolve); } };
        }
        insertValues = { ...(Array.isArray(values) ? values[0] : values) };
        if (table === "client_onboarding_invitations") insertValues.id ??= "abababab-abab-4bab-8bab-abababababab";
        return this;
      },
      delete() {
        return {
          eq(key, value) {
            const index = records.findIndex((row) => row[key] === value);
            if (index >= 0) records.splice(index, 1);
            return Promise.resolve({ error: null });
          },
        };
      },
      maybeSingle() { return Promise.resolve(execute(true)); },
      then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject); },
    };
    function execute(single) {
      if (table === "user_roles" && updateValues && state.failRoleUpdate) {
        return { data: null, error: { code: "role_update_failed" } };
      }
      const found = records.filter((row) => filters.every((filter) => filter(row)));
      if (insertValues && !insertApplied) {
        records.push(insertValues);
        insertApplied = true;
        return { data: single ? insertValues : null, error: null };
      }
      if (updateValues) found.forEach((row) => Object.assign(row, updateValues));
      return { data: single ? found[0] ?? null : found, error: null };
    }
    return builder;
  }

  const client = {
    from: query,
    auth: {
      admin: {
        async inviteUserByEmail(email, options) {
          state.authCreateCalls += 1;
          if (state.failInviteOnce) {
            state.failInviteOnce = false;
            return { data: { user: null }, error: { code: "smtp_failed" } };
          }
          if (state.authUsers.some((user) => user.email === email)) {
            return { data: { user: null }, error: { code: "email_exists" } };
          }
          const user = {
            id: userId,
            email,
            invitation_redirect_to: options.redirectTo,
            email_confirmed_at: null,
          };
          state.authUsers.push(user);
          return { data: { user }, error: null };
        },
        async getUserById(id) {
          const user = state.authUsers.find((record) => record.id === id);
          return { data: { user: user ?? null }, error: user ? null : { code: "not_found" } };
        },
        async updateUserById(id, values) {
          const user = state.authUsers.find((record) => record.id === id);
          if (!user) return { data: { user: null }, error: { code: "not_found" } };
          if (state.authUsers.some((other) => other.id !== id && other.email === values.email)) {
            return { data: { user: null }, error: { code: "email_exists" } };
          }
          Object.assign(user, values);
          return { data: { user }, error: null };
        },
        async deleteUser(id) {
          state.authUsers = state.authUsers.filter((user) => user.id !== id);
          return { error: null };
        },
      },
    },
  };
  globalThis.__fnd05 = {
    client,
    async requireRole(role) {
      if (role !== "admin" || globalThis.__fnd05.currentRole !== "admin") {
        throw new Error("access denied");
      }
      return { userId: "33333333-3333-4333-8333-333333333333" };
    },
    currentRole: "admin",
    provision: provisionClientAccount,
    retry: (id) => retryClientInvitation(id),
    update: updateClientAccount,
    revalidated: state.revalidated,
  };
  return state;
}

test("client creation sends a secure invitation and stores no plaintext password", async () => {
  const state = setup();
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    email: "fictional@example.invalid",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(result.status, "success");
  assert.deepEqual(result.invitation, {
    deliveryStatus: "sent",
    email: "fictional@example.invalid",
    invitationId: "abababab-abab-4bab-8bab-abababababab",
  });
  assert.equal(state.authUsers[0].email_confirmed_at, null);
  assert.match(state.authUsers[0].invitation_redirect_to, /intent=invite/u);
  assert.deepEqual(state.roles[0], {
    account_status: "active",
    candidate_profile_id: candidateId,
    role_code: "client",
    user_id: userId,
  });
  assert.ok(!JSON.stringify(state).includes("temporaryPassword"));
  assert.equal(state.invitations[0].delivery_status, "sent");
  assert.equal(state.invitations[0].auth_user_id, userId);
});

test("failed invitation delivery has a durable state and retries exactly once", async () => {
  const state = setup();
  state.failInviteOnce = true;
  const failed = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId, accountStatus: "active",
  }));
  assert.equal(failed.status, "error");
  assert.equal(failed.invitation.deliveryStatus, "failed");
  assert.equal(state.invitations[0].delivery_status, "failed");
  assert.equal(state.roles.length, 0);

  const retried = await createClientAccountAction(failed, form({
    retryInvitationId: failed.invitation.invitationId,
  }));
  assert.equal(retried.status, "success");
  assert.equal(retried.invitation.deliveryStatus, "sent");
  assert.equal(state.invitations[0].attempt_count, 2);
  assert.equal(state.roles.length, 1);
  assert.equal(state.authCreateCalls, 2);

  assert.deepEqual(await retryClientInvitation(failed.invitation.invitationId), {
    code: "invitation-state", ok: false,
  });
  assert.equal(state.authCreateCalls, 2);
});

test("admin provisioning persists all authoritative fields on the existing profile", async () => {
  const state = setup();
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    fullName: "  Fictional   Updated  ",
    email: "updated@example.invalid",
    mobileNumber: "+44 7700 900123",
    whatsappNumber: "+44 7700 900456",
    linkedinUrl: "linkedin.com/in/fictional-updated?trk=qa",
    currentLocation: "  London,   United Kingdom ",
    relocationPreference: "conditional",
    packageCode: "gcc-middle-east",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(result.status, "success");
  assert.equal(state.candidates.length, 1);
  assert.equal(state.roles[0].candidate_profile_id, candidateId);
  assert.equal(state.candidates[0].full_name, "Fictional Updated");
  assert.equal(state.candidates[0].primary_email, "updated@example.invalid");
  assert.equal(state.candidates[0].mobile_number, "+447700900123");
  assert.equal(state.candidates[0].whatsapp_number, "+447700900456");
  assert.equal(state.candidates[0].linkedin_url, "https://linkedin.com/in/fictional-updated");
  assert.equal(state.candidates[0].current_location, "London, United Kingdom");
  assert.equal(state.candidates[0].relocation_preference, "conditional");
  assert.equal(state.candidates[0].selected_package_code, "gcc-middle-east");
  assert.deepEqual(state.candidates[0].target_markets, ["gcc-middle-east"]);
  assert.equal(state.authUsers[0].email, "updated@example.invalid");
  assert.equal(result.invitation.deliveryStatus, "sent");
});

test("admin can provision a new candidate before the first private resume upload", async () => {
  const state = setup();
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: "new",
    fullName: "New Fictional Client",
    email: "new-fictional@example.invalid",
    mobileNumber: "+447700900321",
    currentLocation: "London, United Kingdom",
    relocationPreference: "open",
    packageCode: "gcc-middle-east",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(result.status, "success");
  assert.equal(state.candidates.length, 2);
  const created = state.candidates[1];
  assert.equal(created.existing_resume_file_id, null);
  assert.equal(created.full_name, "New Fictional Client");
  assert.equal(created.selected_package_code, "gcc-middle-east");
  assert.equal(state.roles[0].candidate_profile_id, created.id);
  assert.equal(state.authUsers[0].email, created.primary_email);
});

test("failed new-candidate linkage retains retryable profile state and removes the Auth user", async () => {
  const state = setup();
  state.failRoleInsert = true;
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: "new",
    fullName: "Rollback Fiction",
    email: "rollback-fiction@example.invalid",
    mobileNumber: "+447700900321",
    currentLocation: "London, United Kingdom",
    packageCode: "indian-domestic",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(result.status, "error");
  assert.equal(state.candidates.length, 2);
  assert.equal(state.authUsers.length, 0);
  assert.equal(state.roles.length, 0);
  assert.equal(state.invitations[0].delivery_status, "failed");
});

test("invalid core fields and inactive package are rejected before account creation", async () => {
  const state = setup();
  const invalid = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    fullName: "",
    mobileNumber: "bad",
    linkedinUrl: "https://example.invalid/in/not-linkedin",
    currentLocation: "",
    relocationPreference: "unknown",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(invalid.status, "error");
  for (const key of ["fullName", "mobileNumber", "linkedinUrl", "currentLocation", "relocationPreference"]) {
    assert.equal(typeof invalid.fieldErrors[key], "string");
  }
  assert.equal(state.authCreateCalls, 0);
  const invalidPackage = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    packageCode: "not-a-package",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(invalidPackage.status, "error");
  assert.equal(state.authCreateCalls, 0);
});

test("failed role linkage preserves authoritative edits for safe invitation retry", async () => {
  const state = setup();
  state.failRoleInsert = true;
  const before = structuredClone(state.candidates[0]);
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    fullName: "Changed Fiction",
    email: "changed@example.invalid",
    packageCode: "gcc-middle-east",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(result.status, "error");
  assert.equal(state.authUsers.length, 0);
  assert.equal(state.roles.length, 0);
  assert.notEqual(state.candidates[0].full_name, before.full_name);
  assert.equal(state.candidates[0].full_name, "Changed Fiction");
  assert.equal(state.invitations[0].delivery_status, "failed");
});

test("duplicate email and candidate linkage are rejected", async () => {
  const state = setup();
  state.authUsers.push({ id: "other", email: "fictional@example.invalid" });
  const input = {
    accountStatus: "active",
    candidateProfileId: candidateId,
    profile,
    temporaryPassword: "ValidPassword1!",
  };
  assert.deepEqual(await provisionClientAccount(input), { code: "duplicate-email", ok: false });
  state.authUsers.length = 0;
  state.roles.push({ user_id: "other", candidate_profile_id: candidateId, role_code: "client" });
  assert.deepEqual(await provisionClientAccount(input), { code: "duplicate-profile", ok: false });
  assert.equal(state.authCreateCalls, 1);
});

test("malformed creation input is rejected before Auth invitation", async () => {
  const state = setup();
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    email: "bad-email",
    credentialMode: "manual",
    temporaryPassword: "weak",
    accountStatus: "active",
  }));
  assert.equal(result.status, "error");
  assert.ok(result.fieldErrors.email);
  assert.equal(state.authCreateCalls, 0);
});

test("missing candidate is rejected and disabled provisioning records disabled status", async () => {
  const state = setup();
  const input = {
    accountStatus: "disabled",
    candidateProfileId: candidateId,
    profile,
    temporaryPassword: "ValidPassword1!",
  };
  state.candidates.length = 0;
  assert.deepEqual(await provisionClientAccount(input), { code: "missing-candidate", ok: false });
  assert.equal(state.authCreateCalls, 0);
  state.candidates.push({
    id: candidateId,
    full_name: "Fictional Candidate",
    primary_email: "fictional@example.invalid",
    mobile_number: "+919876543210",
    whatsapp_number: null,
    linkedin_url: null,
    current_location: "Kolkata, India",
    relocation_preference: "not-specified",
    selected_package_code: "indian-domestic",
    target_markets: ["indian-domestic"],
    archived_at: null,
  });
  assert.deepEqual(await provisionClientAccount(input), {
    invitationId: "abababab-abab-4bab-8bab-abababababab",
    ok: true,
    packageName: "Indian Domestic",
  });
  assert.equal(state.roles[0].account_status, "disabled");
});

test("provisioning and edits require an admin role", async () => {
  const state = setup();
  globalThis.__fnd05.currentRole = "client";
  await assert.rejects(() => provisionClientAccount({
    accountStatus: "active",
    candidateProfileId: candidateId,
    profile,
    temporaryPassword: "ValidPassword1!",
  }), /access denied/);
  await assert.rejects(() => updateClientAccount({
    accountStatus: "disabled",
    confirmDeactivation: true,
    profile: { ...profile, packageCode: "gcc-middle-east" },
    userId,
  }), /access denied/);
  assert.equal(state.authCreateCalls, 0);
});

test("package, email and status edits preserve the client/profile link", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  const changed = await editClientAccountAction({ status: "idle" }, form({
    userId,
    fullName: "Fictional Revised",
    email: "changed@example.invalid",
    mobileNumber: "+44 7700 900123",
    whatsappNumber: "+44 7700 900456",
    linkedinUrl: "linkedin.com/in/fictional-revised",
    currentLocation: "London, United Kingdom",
    relocationPreference: "open",
    packageCode: "gcc-middle-east",
    accountStatus: "disabled",
    confirmDeactivation: "on",
  }));
  assert.equal(changed.status, "success");
  assert.equal(state.roles[0].account_status, "disabled");
  assert.equal(state.roles[0].candidate_profile_id, candidateId);
  assert.equal(state.authUsers[0].email, "changed@example.invalid");
  assert.equal(state.candidates[0].primary_email, "changed@example.invalid");
  assert.equal(state.candidates[0].full_name, "Fictional Revised");
  assert.equal(state.candidates[0].mobile_number, "+447700900123");
  assert.equal(state.candidates[0].whatsapp_number, "+447700900456");
  assert.equal(state.candidates[0].linkedin_url, "https://linkedin.com/in/fictional-revised");
  assert.equal(state.candidates[0].current_location, "London, United Kingdom");
  assert.equal(state.candidates[0].relocation_preference, "open");
  assert.equal(state.candidates[0].selected_package_code, "gcc-middle-east");
  assert.deepEqual(state.candidates[0].target_markets, ["gcc-middle-east"]);

  const restored = await editClientAccountAction({ status: "idle" }, form({
    userId,
    email: "changed@example.invalid",
    packageCode: "gcc-middle-east",
    accountStatus: "active",
  }));
  assert.equal(restored.status, "success");
  assert.equal(state.roles[0].account_status, "active");
});

test("successive package changes survive fresh service reloads and revalidate every save", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  let previousState = { status: "idle" };
  for (const [code, displayName, markets] of [
    ["gcc-middle-east", "GCC / Middle East", ["gcc-middle-east"]],
    ["europass-european-union", "Europass / EU", ["european-union"]],
    ["executive-transition-agency-distribution", "Executive All-Inclusive", ["indian-domestic", "gcc-middle-east", "european-union"]],
  ]) {
    const result = await editClientAccountAction(previousState, form({ userId, packageCode: code, accountStatus: "active" }));
    assert.equal(result.status, "success", code);
    assert.equal(result.saveRevision, (previousState.saveRevision ?? 0) + 1);
    assert.equal(state.candidates[0].selected_package_code, code);
    assert.deepEqual(state.candidates[0].target_markets, markets);
    const reloaded = await getProvisionedClient(userId);
    assert.equal(reloaded.packageCode, code, "fresh database-backed service read");
    assert.equal(reloaded.packageName, displayName);
    assert.equal(reloaded.candidateProfileId, candidateId);
    previousState = result;
  }
  assert.equal(state.revalidated.filter((path) => path === `/admin/clients/${userId}/edit`).length, 3);
  assert.equal(state.revalidated.filter((path) => path === "/admin/clients").length, 3);
  assert.equal(state.revalidated.filter((path) => path === "/client").length, 3);
});

test("an unknown active database package is still rejected by the frozen V1 catalog", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  state.packages.push({ code: "unapproved-eighth", display_name: "Unapproved", target_markets: ["indian-domestic"], is_active: true, archived_at: null });
  const result = await editClientAccountAction({ status: "idle" }, form({ userId, packageCode: "unapproved-eighth", accountStatus: "active" }));
  assert.equal(result.status, "error");
  assert.equal(state.candidates[0].selected_package_code, "indian-domestic");
  assert.equal((await getProvisionedClient(userId)).packageCode, "indian-domestic");
});

test("failed status update rolls back edited core fields, package and Auth email", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  state.failRoleUpdate = true;
  const before = structuredClone(state.candidates[0]);
  const result = await editClientAccountAction({ status: "idle" }, form({
    userId,
    fullName: "Temporary Change",
    email: "temporary@example.invalid",
    mobileNumber: "+447700900123",
    packageCode: "gcc-middle-east",
    accountStatus: "disabled",
    confirmDeactivation: "on",
  }));
  assert.equal(result.status, "error");
  for (const key of ["full_name", "primary_email", "mobile_number", "current_location", "relocation_preference", "selected_package_code"]) {
    assert.equal(state.candidates[0][key], before[key], key);
  }
  assert.deepEqual(state.candidates[0].target_markets, before.target_markets);
  assert.equal(state.authUsers[0].email, "fictional@example.invalid");
  assert.equal(state.roles[0].account_status, "active");
});

test("invalid package and missing deactivation confirmation leave records untouched", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  assert.deepEqual(await updateClientAccount({
    accountStatus: "active", confirmDeactivation: false,
    profile: { ...profile, packageCode: "invalid" }, userId,
  }), { code: "invalid-package", ok: false });
  assert.deepEqual(await updateClientAccount({
    accountStatus: "disabled", confirmDeactivation: false,
    profile, userId,
  }), { code: "confirmation-required", ok: false });
  assert.equal(state.roles[0].account_status, "active");
  assert.equal(state.candidates[0].selected_package_code, "indian-domestic");
});

test("duplicate email edit leaves Auth, package, status and linkage unchanged", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  state.candidates.push({
    id: "44444444-4444-4444-8444-444444444444",
    primary_email: "taken@example.invalid",
    archived_at: null,
  });
  assert.deepEqual(await updateClientAccount({
    accountStatus: "active", confirmDeactivation: false,
    profile: { ...profile, email: "taken@example.invalid", packageCode: "gcc-middle-east" }, userId,
  }), { code: "duplicate-email", ok: false });
  assert.equal(state.authUsers[0].email, "fictional@example.invalid");
  assert.equal(state.candidates[0].selected_package_code, "indian-domestic");
  assert.equal(state.roles[0].candidate_profile_id, candidateId);
  assert.equal(state.roles[0].account_status, "active");
});

test("invalid account status is rejected on both creation and edit", async () => {
  const state = setup();
  const created = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    email: "fictional@example.invalid",
    credentialMode: "generated",
    accountStatus: "unexpected",
  }));
  const edited = await editClientAccountAction({ status: "idle" }, form({
    userId,
    email: "fictional@example.invalid",
    packageCode: "indian-domestic",
    accountStatus: "unexpected",
  }));
  assert.equal(created.status, "error");
  assert.equal(edited.status, "error");
  assert.equal(state.authCreateCalls, 0);
});

test("server authorization denies anonymous, cross-role and disabled access", async () => {
  setup();
  let claimedUserId = null;
  let roleRecord = null;
  globalThis.__fnd05.serverClient = {
    auth: {
      async getClaims() {
        return {
          data: { claims: claimedUserId ? { sub: claimedUserId } : null },
          error: null,
        };
      },
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: roleRecord, error: null }; },
      };
    },
  };
  await assert.rejects(() => requireApplicationRole("admin"), /REDIRECT:\/login\?portal=admin/);
  claimedUserId = userId;
  roleRecord = { role_code: "client", account_status: "active", candidate_profile_id: candidateId };
  await assert.rejects(() => requireApplicationRole("admin"), /REDIRECT:\/access-denied\?portal=admin/);
  assert.equal((await requireApplicationRole("client")).userId, userId);
  roleRecord.account_status = "disabled";
  await assert.rejects(() => requireApplicationRole("client"), /REDIRECT:\/access-denied\?portal=client/);
  roleRecord = { role_code: "admin", account_status: "active", candidate_profile_id: null };
  await assert.rejects(() => requireApplicationRole("client"), /REDIRECT:\/access-denied\?portal=client/);
  assert.equal((await requireApplicationRole("admin")).userId, userId);
});

test("browser auth maps login intent and signs out the local session", async () => {
  setup();
  let activeSession = false;
  let signOutScope;
  globalThis.__fnd05.browserClient = {
    auth: {
      async signInWithPassword({ email, password }) {
        if (email !== "fictional@example.invalid" || password !== "ValidPassword1!") {
          return { data: { user: null }, error: { code: "invalid_credentials" } };
        }
        activeSession = true;
        return { data: { user: { id: userId, email } }, error: null };
      },
      async signOut({ scope }) {
        signOutScope = scope;
        activeSession = false;
        return { error: null };
      },
    },
  };
  const signedIn = await signInWithPassword({
    email: "fictional@example.invalid",
    password: "ValidPassword1!",
    portal: "client",
  });
  assert.equal(signedIn.redirectTo, "/client");
  assert.equal(activeSession, true);
  await assert.rejects(
    () => signInWithPassword({ email: "fictional@example.invalid", password: "wrong", portal: "client" }),
    /email address or password is incorrect/i,
  );
  await assert.rejects(
    () => signInWithPassword({ email: "unknown@example.invalid", password: "ValidPassword1!", portal: "client" }),
    /email address or password is incorrect/i,
  );
  const adminIntent = await signInWithPassword({
    email: "fictional@example.invalid", password: "ValidPassword1!", portal: "admin",
  });
  assert.equal(adminIntent.redirectTo, "/admin");
  assert.deepEqual(await signOut("client"), { redirectTo: "/login?portal=client" });
  assert.equal(signOutScope, "local");
  assert.equal(activeSession, false);
});
