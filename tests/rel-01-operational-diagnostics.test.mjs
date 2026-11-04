import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("release diagnostics cover role and DOC-13 failure states without write SQL or private keys", () => {
  const document = readFileSync(new URL("../docs/REL_01_OPERATIONAL_DIAGNOSTICS.md", import.meta.url), "utf8");
  const queries = [...document.matchAll(/```sql\r?\n([\s\S]*?)```/g)].map((match) => match[1]).join("\n");
  for (const required of ["active_unlinked_clients", "disabled_unlinked_clients",
    "duplicate_profile_link_groups", "resume_processing_jobs", "document_regeneration_jobs", "at_max_attempts",
    "available_documents_missing_file_record", "available_documents_missing_storage_metadata",
    "duplicate_current_output_groups", "expired_document_leases", "storage.objects",
    "zevantaa-automation-worker", "invalid_ats_snapshot_totals", "stale_current_ats_snapshots"]) {
    assert.ok(queries.includes(required), required);
  }
  assert.doesNotMatch(queries, /\b(?:update|delete|insert|alter|drop|truncate|execute)\b/i);
  assert.doesNotMatch(queries, /storage_object_key\s+(?:as|,|from)/i);
});
