import { pathToFileURL } from "node:url";

const PLACEHOLDER = /^(?:$|your[-_]|replace[-_]|placeholder|example|change[-_])/i;
const REQUIRED = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SECURITY_RATE_LIMIT_KEY"];

export function validateEnvironment(environment, values = process.env) {
  const problems = [];
  if (!["local", "preview", "production"].includes(environment)) {
    return ["DEPLOYMENT_ENV must be local, preview, or production."];
  }
  if (environment === "local") return problems;
  for (const name of REQUIRED) {
    if (!values[name] || PLACEHOLDER.test(values[name].trim())) problems.push(`${name} is missing or a placeholder.`);
  }
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    if (!values[name]) continue;
    try {
      const url = new URL(values[name]);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
          (name === "NEXT_PUBLIC_APP_URL" && url.pathname !== "/")) {
        problems.push(`${name} must be a clean HTTPS origin/URL without credentials, query, or fragment.`);
      }
    } catch { problems.push(`${name} is not a valid URL.`); }
  }
  if (environment === "production" && values.NEXT_PUBLIC_APP_URL?.includes("localhost")) {
    problems.push("Production NEXT_PUBLIC_APP_URL cannot be localhost.");
  }
  if (values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && /(?:sb_secret_|service_role)/i.test(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    problems.push("The browser publishable key must not be a secret/service-role key.");
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
