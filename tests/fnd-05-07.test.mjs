import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const emptyModule = "data:text/javascript,export%20{}";
const authorizationModule =
  "data:text/javascript,export%20async%20function%20requireApplicationRole(role)%7Breturn%20globalThis.__fnd05.requireRole(role)%7D";
const adminModule =
  "data:text/javascript,export%20function%20createSupabaseAdminClient()%7Breturn%20globalThis.__fnd05.client%7D";
const actionServiceModule =
  "data:text/javascript,export%20async%20function%20provisionClientAccount(input)%7Breturn%20globalThis.__fnd05.provision(input)%7D%3Bexport%20async%20function%20updateClientAccount(input)%7Breturn%20globalThis.__fnd05.update(input)%7D";
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
      specifier.startsWith("./") &&
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
const { provisionClientAccount, updateClientAccount } = await import(
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

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
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
        selected_package_code: "indian-domestic",
        target_markets: ["indian-domestic"],
        archived_at: null,
      },
    ],
    packages: [
      {
        code: "indian-domestic",
        target_markets: ["indian-domestic"],
        is_active: true,
        archived_at: null,
      },
      {
        code: "gcc-middle-east",
        target_markets: ["gcc-middle-east"],
        is_active: true,
        archived_at: null,
      },
    ],
    roles: [],
    authCreateCalls: 0,
  };

  function query(table) {
    const records =
      table === "candidate_profiles"
        ? state.candidates
        : table === "package_definitions"
          ? state.packages
          : state.roles;
    const filters = [];
    let updateValues;
    const builder = {
      select() { return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      neq(key, value) { filters.push((row) => row[key] !== value); return this; },
      is(key, value) { filters.push((row) => row[key] === value); return this; },
      update(values) { updateValues = values; return this; },
      insert(values) {
        records.push({ ...values });
        return Promise.resolve({ error: null });
      },
      maybeSingle() { return Promise.resolve(execute(true)); },
      then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject); },
    };
    function execute(single) {
      const found = records.filter((row) => filters.every((filter) => filter(row)));
      if (updateValues) found.forEach((row) => Object.assign(row, updateValues));
      return { data: single ? found[0] ?? null : found, error: null };
    }
    return builder;
  }

  const client = {
    from: query,
    auth: {
      admin: {
        async createUser({ email, password, email_confirm }) {
          state.authCreateCalls += 1;
          if (state.authUsers.some((user) => user.email === email)) {
            return { data: { user: null }, error: { code: "email_exists" } };
          }
          const user = {
            id: userId,
            email,
            password,
            email_confirmed_at: email_confirm ? new Date().toISOString() : null,
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
    update: updateClientAccount,
  };
  return state;
}

test("generated credentials create a confirmed, linked client without a database password", async () => {
  const state = setup();
  const result = await createClientAccountAction({ status: "idle" }, form({
    candidateProfileId: candidateId,
    email: "fictional@example.invalid",
    credentialMode: "generated",
    accountStatus: "active",
  }));
  assert.equal(result.status, "success");
  assert.match(result.credentials.temporaryPassword, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{20}$/);
  assert.ok(state.authUsers[0].email_confirmed_at);
  assert.deepEqual(state.roles[0], {
    account_status: "active",
    candidate_profile_id: candidateId,
    role_code: "client",
    user_id: userId,
  });
  assert.ok(!JSON.stringify(state.roles).includes(result.credentials.temporaryPassword));
  assert.ok(!JSON.stringify(state.candidates).includes(result.credentials.temporaryPassword));
});

test("duplicate email and candidate linkage are rejected", async () => {
  const state = setup();
  state.authUsers.push({ id: "other", email: "fictional@example.invalid" });
  const input = {
    accountStatus: "active",
    candidateProfileId: candidateId,
    email: "fictional@example.invalid",
    temporaryPassword: "ValidPassword1!",
  };
  assert.deepEqual(await provisionClientAccount(input), { code: "duplicate-email", ok: false });
  state.authUsers.length = 0;
  state.roles.push({ user_id: "other", candidate_profile_id: candidateId, role_code: "client" });
  assert.deepEqual(await provisionClientAccount(input), { code: "duplicate-profile", ok: false });
  assert.equal(state.authCreateCalls, 1);
});

test("weak or malformed creation input is rejected before Auth creation", async () => {
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
  assert.ok(result.fieldErrors.temporaryPassword);
  assert.equal(state.authCreateCalls, 0);
});

test("missing candidate is rejected and disabled provisioning records disabled status", async () => {
  const state = setup();
  const input = {
    accountStatus: "disabled",
    candidateProfileId: candidateId,
    email: "fictional@example.invalid",
    temporaryPassword: "ValidPassword1!",
  };
  state.candidates.length = 0;
  assert.deepEqual(await provisionClientAccount(input), { code: "missing-candidate", ok: false });
  assert.equal(state.authCreateCalls, 0);
  state.candidates.push({
    id: candidateId,
    full_name: "Fictional Candidate",
    primary_email: "fictional@example.invalid",
    selected_package_code: "indian-domestic",
    target_markets: ["indian-domestic"],
    archived_at: null,
  });
  assert.deepEqual(await provisionClientAccount(input), { ok: true });
  assert.equal(state.roles[0].account_status, "disabled");
});

test("provisioning and edits require an admin role", async () => {
  const state = setup();
  globalThis.__fnd05.currentRole = "client";
  await assert.rejects(() => provisionClientAccount({
    accountStatus: "active",
    candidateProfileId: candidateId,
    email: "fictional@example.invalid",
    temporaryPassword: "ValidPassword1!",
  }), /access denied/);
  await assert.rejects(() => updateClientAccount({
    accountStatus: "disabled",
    confirmDeactivation: true,
    email: "fictional@example.invalid",
    packageCode: "gcc-middle-east",
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
    email: "changed@example.invalid",
    packageCode: "gcc-middle-east",
    accountStatus: "disabled",
    confirmDeactivation: "on",
  }));
  assert.equal(changed.status, "success");
  assert.equal(state.roles[0].account_status, "disabled");
  assert.equal(state.roles[0].candidate_profile_id, candidateId);
  assert.equal(state.authUsers[0].email, "changed@example.invalid");
  assert.equal(state.candidates[0].primary_email, "changed@example.invalid");
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

test("invalid package and missing deactivation confirmation leave records untouched", async () => {
  const state = setup();
  state.authUsers.push({ id: userId, email: "fictional@example.invalid" });
  state.roles.push({ user_id: userId, role_code: "client", candidate_profile_id: candidateId, account_status: "active" });
  assert.deepEqual(await updateClientAccount({
    accountStatus: "active", confirmDeactivation: false,
    email: "fictional@example.invalid", packageCode: "invalid", userId,
  }), { code: "invalid-package", ok: false });
  assert.deepEqual(await updateClientAccount({
    accountStatus: "disabled", confirmDeactivation: false,
    email: "fictional@example.invalid", packageCode: "indian-domestic", userId,
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
    email: "taken@example.invalid", packageCode: "gcc-middle-east", userId,
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
  assert.deepEqual(await signOut("client"), { redirectTo: "/login?portal=client" });
  assert.equal(signOutScope, "local");
  assert.equal(activeSession, false);
});
