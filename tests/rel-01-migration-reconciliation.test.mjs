import assert from "node:assert/strict";
import { test } from "node:test";
import { compareMigrationHistory, readLocalMigrations } from "../scripts/check-migration-reconciliation.mjs";

test("repository migration inventory is ordered and has no duplicate names or versions", () => {
  const local = readLocalMigrations();
  assert.equal(local.length, 18);
  assert.equal(new Set(local.map((row) => row.name)).size, local.length);
  assert.equal(new Set(local.map((row) => row.version)).size, local.length);
});

test("DOC-13 recorded SQL is recognized as applied under its alternate version, not replayed", () => {
  const local = readLocalMigrations().filter((row) => row.name.startsWith("doc_13_"));
  const remote = [
    { version: "20261023190731", name: "doc_13_persistent_documents", body_md5: "c88e8996ff5ab225430b8a2e9497048c" },
    { version: "20261023190738", name: "doc_13_document_lifecycle", body_md5: "a8d74654deba31474afe914472562104" },
  ];
  const result = compareMigrationHistory(local, remote);
  assert.equal(result.ok, true);
  assert.deepEqual(result.matches.map((row) => row.status), [
    "equivalent-sql-version-alias", "equivalent-sql-version-alias",
  ]);
});

test("unknown SQL, missing checksum, missing migration or order mismatch fails closed", () => {
  const local = readLocalMigrations().filter((row) => row.name.startsWith("doc_13_"));
  const remote = local.map((row) => ({ version: row.version, name: row.name, body_md5: row.bodyMd5 }));
  assert.equal(compareMigrationHistory(local, remote).ok, true);
  assert.equal(compareMigrationHistory(local, [{ ...remote[0], body_md5: "0".repeat(32) }, remote[1]]).ok, false);
  assert.equal(compareMigrationHistory(local, [{ ...remote[0], body_md5: "" }, remote[1]]).ok, false);
  assert.equal(compareMigrationHistory(local, remote.slice(0, 1)).ok, false);
  assert.equal(compareMigrationHistory(local, [...remote].reverse().map((row, i) => ({ ...row, version: remote[i].version }))).ok, false);
  assert.equal(compareMigrationHistory(local, [remote[0], remote[0]]).ok, false);
});
