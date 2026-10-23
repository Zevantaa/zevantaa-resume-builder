import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

process.env.SUPABASE_SECRET_KEY = "fictional-test-only-signing-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

const mock = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: mock("export {}"), shortCircuit: true };
    if (specifier === "next/server") return {
      url: mock(`export const NextResponse = { redirect(url) { return {
        url: String(url), cookies: { set(name, value, options) {
          globalThis.__recovery.setCookie = { name, value, options };
        } }
      }; } };`), shortCircuit: true,
    };
    if (specifier === "next/headers") return {
      url: mock("export async function cookies() { return globalThis.__recovery.cookies; }"), shortCircuit: true,
    };
    if (specifier === "@/features/authentication") return {
      url: mock("export function getAuthPortalIntent(value) { return value === 'admin' ? 'admin' : 'client'; }"), shortCircuit: true,
    };
    if (specifier === "@/lib/supabase/server") return {
      url: mock("export async function createServerSupabaseClient() { return globalThis.__recovery.supabase; }"), shortCircuit: true,
    };
    if (specifier === "@/lib/supabase/config") return {
      url: mock("export function isSupabaseConfigured() { return true; } export class SupabaseConfigurationError extends Error {}"), shortCircuit: true,
    };
    if (specifier === "@/lib/supabase/client") return {
      url: mock("export function createBrowserSupabaseClient() { return globalThis.__recovery.browser; }"), shortCircuit: true,
    };
    if (specifier === "@/features/authentication/recovery-origin") return nextResolve(
      new URL("../src/features/authentication/recovery-origin.ts", import.meta.url).href, context,
    );
    if (specifier === "./recovery-origin") return nextResolve(
      new URL("../src/features/authentication/recovery-origin.ts", import.meta.url).href, context,
    );
    if (specifier === "./config" && context.parentURL?.endsWith("auth-service.ts")) return nextResolve(
      new URL("../src/features/authentication/config.ts", import.meta.url).href, context,
    );
    if (specifier === "@/features/authentication/recovery-proof") return nextResolve(
      new URL("../src/features/authentication/recovery-proof.ts", import.meta.url).href, context,
    );
    if ((specifier.startsWith("./") || specifier.startsWith("../")) &&
        context.parentURL?.endsWith(".ts") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { GET } = await import("../src/app/auth/callback/route.ts");
const { createRecoveryProof, isValidRecoveryProof } = await import(
  "../src/features/authentication/recovery-proof.ts"
);
const { updateRecoveryPasswordAction } = await import(
  "../src/features/authentication/update-recovery-password-action.ts"
);
const { hasVerifiedRecoverySession } = await import(
  "../src/features/authentication/recovery-session.ts"
);
const { requestPasswordRecovery } = await import(
  "../src/features/authentication/auth-service.ts"
);
const { getCanonicalRecoveryOrigin } = await import(
  "../src/features/authentication/recovery-origin.ts"
);

const userId = "11111111-1111-4111-8111-111111111111";
function reset() {
  const state = {
    setCookie: undefined,
    proof: undefined,
    password: undefined,
    signedOut: false,
    exchangeArgs: undefined,
    cookies: {
      get() { return state.proof ? { value: state.proof } : undefined; },
      set(_name, value, options) {
        if (value === "" && options.path === "/reset-password" && options.maxAge === 0) {
          state.proof = undefined;
        }
      },
    },
    supabase: {
      auth: {
        async exchangeCodeForSession(...args) {
          state.exchangeArgs = args;
          return { data: { user: { id: userId }, redirectType: "recovery" }, error: null };
        },
        async verifyOtp(input) {
          state.verifyInput = input;
          return { data: { user: { id: userId } }, error: null };
        },
        async getUser() { return { data: { user: { id: userId } }, error: null }; },
        async updateUser(input) { state.password = input.password; return { error: null }; },
        async signOut() { state.signedOut = true; return { error: null }; },
      },
    },
    browser: {
      auth: {
        async resetPasswordForEmail(_email, options) {
          state.requestRedirect = options.redirectTo;
          return { error: null };
        },
      },
    },
  };
  globalThis.__recovery = state;
  return state;
}

test("recovery request uses only configured canonical origin, never caller origin", async () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://resume.example.test";
  try {
    const state = reset();
    await requestPasswordRecovery({
      email: "fictional@example.test", portal: "admin", redirectOrigin: "https://attacker.example",
    });
    assert.equal(state.requestRedirect, "https://resume.example.test/auth/callback?portal=admin");
    assert.equal(getCanonicalRecoveryOrigin("https://resume.example.test/extra", true), null);
    assert.equal(getCanonicalRecoveryOrigin("https://resume.example.test?x=1", true), null);
    assert.equal(getCanonicalRecoveryOrigin("http://resume.example.test", true), null);
    assert.equal(getCanonicalRecoveryOrigin("http://localhost:3000", false), "http://localhost:3000");
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("PKCE callback preserves portal and forwards an explicit flow ID", async () => {
  const state = reset();
  const response = await GET(new Request("http://localhost:3000/auth/callback?portal=admin&code=opaque&sb_flow_id=flow-123"));
  assert.equal(response.url, "http://localhost:3000/reset-password?portal=admin");
  assert.deepEqual(state.exchangeArgs, ["opaque", { flowId: "flow-123" }]);
  assert.equal(state.setCookie.options.httpOnly, true);
  assert.equal(isValidRecoveryProof(state.setCookie.value, userId), true);
});

test("PKCE callback works without optional flow ID", async () => {
  const state = reset();
  await GET(new Request("http://localhost:3000/auth/callback?portal=client&code=opaque"));
  assert.deepEqual(state.exchangeArgs, ["opaque", undefined]);
});

test("recovery redirect ignores untrusted forwarding headers and uses configured origin", async () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://resume.example.test";
  try {
    reset();
    const response = await GET(new Request("http://localhost:3000/auth/callback?portal=admin&code=opaque", {
      headers: { "x-forwarded-host": "attacker.example", "x-forwarded-proto": "https" },
    }));
    assert.equal(response.url, "https://resume.example.test/reset-password?portal=admin");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("production recovery callback fails closed without a canonical HTTPS origin", async () => {
  const previousOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_URL;
    const missing = await GET(new Request("http://localhost:3000/auth/callback?code=opaque"));
    assert.equal(missing.status, 503);
    process.env.NEXT_PUBLIC_APP_URL = "http://insecure.example.test";
    const insecure = await GET(new Request("http://localhost:3000/auth/callback?code=opaque"));
    assert.equal(insecure.status, 503);
    process.env.NEXT_PUBLIC_APP_URL = "https://resume.example.test/extra";
    const nonCanonical = await GET(new Request("http://localhost:3000/auth/callback?code=opaque"));
    assert.equal(nonCanonical.status, 503);
  } finally {
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousOrigin;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("token-hash recovery callback verifies the one-time recovery token", async () => {
  const state = reset();
  const response = await GET(new Request("http://localhost:3000/auth/callback?portal=admin&token_hash=opaque&type=recovery"));
  assert.deepEqual(state.verifyInput, { token_hash: "opaque", type: "recovery" });
  assert.equal(response.url, "http://localhost:3000/reset-password?portal=admin");
  assert.ok(state.setCookie);
});

test("missing, invalid and failed-exchange callbacks fail closed", async () => {
  const state = reset();
  for (const query of ["portal=admin", "portal=admin&type=recovery", "portal=admin&error=access_denied", "portal=admin&token_hash=opaque&type=invite"]) {
    const response = await GET(new Request(`http://localhost:3000/auth/callback?${query}`));
    assert.equal(response.url, "http://localhost:3000/reset-password?portal=admin&error=invalid-link");
  }
  state.supabase.auth.exchangeCodeForSession = async () => ({ data: { user: null }, error: new Error("expired") });
  const expired = await GET(new Request("http://localhost:3000/auth/callback?portal=admin&code=expired"));
  assert.match(expired.url, /error=invalid-link$/);
  assert.equal(state.setCookie, undefined);
});

test("ordinary sign-in code cannot authorize password recovery", async () => {
  const state = reset();
  state.supabase.auth.exchangeCodeForSession = async () => ({ data: { user: { id: userId }, redirectType: null }, error: null });
  const response = await GET(new Request("http://localhost:3000/auth/callback?portal=admin&code=signin"));
  assert.match(response.url, /error=invalid-link$/);
  assert.equal(state.setCookie, undefined);
});

test("proof is user-bound, signed, time-limited, and required for password update", async () => {
  const state = reset();
  assert.equal(await hasVerifiedRecoverySession(), false);
  await assert.rejects(updateRecoveryPasswordAction("secure-password"), /invalid or has expired/);
  state.proof = createRecoveryProof(userId);
  assert.equal(await hasVerifiedRecoverySession(), true);
  assert.equal(isValidRecoveryProof(state.proof, userId), true);
  assert.equal(isValidRecoveryProof(state.proof, "22222222-2222-4222-8222-222222222222"), false);
  assert.equal(isValidRecoveryProof(createRecoveryProof(userId, 0), userId), false);
  await assert.rejects(updateRecoveryPasswordAction("short"), /at least 8/);
  await updateRecoveryPasswordAction("secure-password");
  assert.equal(state.password, "secure-password");
  assert.equal(state.signedOut, true);
  assert.equal(state.proof, undefined);
  assert.equal(await hasVerifiedRecoverySession(), false);
});
