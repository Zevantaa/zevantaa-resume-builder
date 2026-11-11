import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const BUCKETS = new Set([
  "candidate-intake-private",
  "candidate-documents-private",
  "zevantaa-brand-assets",
]);
const PRODUCTION_REF = "fzltowzpfrnuxxxrzuih";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveManifestObject(manifestPath, backupPath) {
  if (typeof backupPath !== "string" || !backupPath.startsWith("objects/")) {
    fail("A Storage manifest backup path is invalid.");
  }
  const root = resolve(dirname(manifestPath));
  const target = resolve(root, backupPath);
  const prefix = `${root}${process.platform === "win32" ? "\\" : "/"}`;
  if (!target.startsWith(prefix)) fail("A Storage manifest path escaped its backup directory.");
  return target;
}

async function main() {
  const manifestPath = resolve(argument("--manifest") ?? "");
  if (!process.argv.includes("--confirm-isolated-target")) fail("Explicit isolated-target confirmation is required.");
  const url = process.env.ISOLATED_SUPABASE_URL;
  const secret = process.env.ISOLATED_SUPABASE_SECRET_KEY;
  const targetRef = process.env.ISOLATED_SUPABASE_PROJECT_REF;
  if (!url || !secret || !targetRef) fail("Isolated Supabase target configuration is incomplete.");
  if (targetRef === PRODUCTION_REF || url.includes(PRODUCTION_REF)) fail("Production can never be a Storage restore target.");
  const targetHost = new URL(url).hostname;
  if (targetRef !== "local-isolated-restore" || !["127.0.0.1", "localhost"].includes(targetHost)) {
    fail("Automated Storage restore is restricted to the isolated local Supabase stack.");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.projectRef !== PRODUCTION_REF || manifest.format !== "zevantaa-private-storage-backup-v1") {
    fail("The Storage manifest is not an approved Zevantaa production backup.");
  }
  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let restored = 0;
  for (const bucket of manifest.buckets ?? []) {
    if (!BUCKETS.has(bucket.name)) fail("The Storage manifest contains an unexpected bucket.");
    const bucketApi = supabase.storage.from(bucket.name);
    for (const object of bucket.objects ?? []) {
      const bytes = await readFile(resolveManifestObject(manifestPath, object.backupPath));
      if (bytes.length !== object.size || createHash("sha256").update(bytes).digest("hex") !== object.sha256) {
        fail("A Storage backup object failed verification before restore.");
      }
      const upload = await bucketApi.upload(object.key, bytes, {
        contentType: object.contentType,
        // The database restore has already recreated storage.objects metadata.
        // This is permitted only because the helper hard-refuses production.
        upsert: true,
      });
      if (upload.error) throw new Error(`An object could not be restored into isolated bucket ${bucket.name}.`);
      const verify = await bucketApi.download(object.key);
      if (verify.error || !verify.data) throw new Error("A restored Storage object could not be read back.");
      const restoredBytes = Buffer.from(await verify.data.arrayBuffer());
      if (createHash("sha256").update(restoredBytes).digest("hex") !== object.sha256) {
        throw new Error("A restored Storage object checksum did not match.");
      }
      restored += 1;
    }
  }
  process.stdout.write(`${JSON.stringify({ bucketCount: BUCKETS.size, restoredObjectCount: restored })}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : "Isolated Storage restore failed."));
