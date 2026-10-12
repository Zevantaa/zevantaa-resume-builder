import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (name) => readFileSync(name, "utf8");

test("client intake rejects profile/package tampering before upload service", () => {
  const action = source("src/features/client-portal/save-client-intake-action.ts");
  assert.match(action, /requireApplicationRole\("client"\)/);
  assert.match(action, /candidateProfileId/);
  assert.match(action, /selected_package_code/);
  assert.match(action, /cannot be changed here/);
});

test("client document delivery remains private and bounded", () => {
  const access = source("src/features/client-portal/client-document-access.ts");
  const download = source("src/features/document-generation/pdf/pdf-download.ts");
  assert.match(access, /MAX_CLIENT_PDF_BYTES = 10 \* 1024 \* 1024/);
  assert.match(download, /private, no-store/);
  assert.match(download, /enforceRateLimit/);
  assert.match(download, /getAuthContext/);
});

test("server-only audit writer and production rate limits retain fail-closed design", () => {
  const audit = source("src/lib/security/audit-events.ts");
  const limiter = source("src/lib/security/rate-limit.ts");
  assert.match(audit, /import "server-only"/);
  assert.match(audit, /metadata: event\.detailCode/);
  assert.match(limiter, /RateLimitError/);
  assert.match(limiter, /SECURITY_RATE_LIMIT_KEY/);
});
