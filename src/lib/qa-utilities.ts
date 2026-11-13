import "server-only";

type QaEnvironment = {
  DEPLOYMENT_ENV?: string;
  ENABLE_QA_UTILITIES?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

/**
 * QA utilities are fail-closed and can never be enabled in a production
 * deployment. Local and preview environments require an explicit server-only
 * opt-in so a copied environment does not expose diagnostic controls by accident.
 */
export function areQaUtilitiesEnabled(environment: QaEnvironment = process.env): boolean {
  const deployment = environment.VERCEL_ENV ?? environment.DEPLOYMENT_ENV;
  if (deployment === "production") return false;
  if (environment.NODE_ENV === "production" && deployment !== "preview") return false;
  return environment.ENABLE_QA_UTILITIES === "true";
}

export function assertQaUtilitiesEnabled(): void {
  if (!areQaUtilitiesEnabled()) throw new Error("QA_NOT_AVAILABLE");
}

export function qaNotFoundResponse(): Response {
  return new Response("Not found.", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
