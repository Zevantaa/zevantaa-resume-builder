import { pathToFileURL } from "node:url";

const PLACEHOLDER = /^(?:$|your[-_]|replace[-_]|placeholder|example|change[-_])/i;
const REQUIRED = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "SECURITY_RATE_LIMIT_KEY"];

export function validateEnvironment(environment, values = process.env) {
  const problems = [];
  if (!["local", "preview", "production"].includes(environment)) {
    return ["DEPLOYMENT_ENV must be local, preview, or production."];
  }
  if (environment === "local") return problems;
  for (const name of REQUIRED) {
    if (!values[name] || PLACEHOLDER.test(values[name].trim())) problems.push(`${name} is missing or a placeholder.`);
  }
  // Match the application's preferred-key precedence exactly. A configured but
  // invalid preferred value must not be hidden by a valid legacy fallback.
  const publicKeyName = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  const publicKey = values[publicKeyName]?.trim();
  if (!publicKey || PLACEHOLDER.test(publicKey)) {
    problems.push(`${publicKeyName} is missing or a placeholder.`);
  } else if (/(?:sb_secret_|service_role)/i.test(publicKey)) {
    problems.push("The browser Supabase key must not be a secret/service-role key.");
  }
  const serverKeyName = values.SUPABASE_SECRET_KEY?.trim()
    ? "SUPABASE_SECRET_KEY" : "SUPABASE_SERVICE_ROLE_KEY";
  const serverKey = values[serverKeyName]?.trim();
  if (!serverKey || PLACEHOLDER.test(serverKey)) {
    problems.push(`${serverKeyName} is missing or a placeholder.`);
  } else if (/sb_publishable_/i.test(serverKey)) {
    problems.push("The server Supabase key must not be a browser publishable key.");
  }
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    if (!values[name]) continue;
    try {
      const url = new URL(values[name]);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
          url.pathname !== "/") {
        problems.push(`${name} must be a clean HTTPS origin/URL without credentials, query, or fragment.`);
      }
    } catch { problems.push(`${name} is not a valid URL.`); }
  }
  if (environment === "production" && values.NEXT_PUBLIC_APP_URL?.includes("localhost")) {
    problems.push("Production NEXT_PUBLIC_APP_URL cannot be localhost.");
  }
  if (values.SECURITY_RATE_LIMIT_KEY && !PLACEHOLDER.test(values.SECURITY_RATE_LIMIT_KEY.trim()) &&
      values.SECURITY_RATE_LIMIT_KEY.length < 32) {
    problems.push("SECURITY_RATE_LIMIT_KEY must contain at least 32 characters.");
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const environment = process.argv[2] ?? process.env.DEPLOYMENT_ENV ?? "local";
  const problems = validateEnvironment(environment);
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${environment} environment configuration passed local validation. Remote settings still require manual verification.\n`);
  }
}
