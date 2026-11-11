import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const BUCKETS = [
  "candidate-intake-private",
  "candidate-documents-private",
  "zevantaa-brand-assets",
];
const PRODUCTION_REF = "fzltowzpfrnuxxxrzuih";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertOutsideRepository(output) {
  if (!output) fail("A Storage backup output path is required.");
  const root = resolve(process.cwd());
  const target = resolve(output);
  const pathFromRoot = relative(root, target);
  if (!isAbsolute(target) || pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))) {
    fail("Storage backup output must be an absolute path outside the Git repository.");
  }
  return target;
}

function projectRefFromUrl(value) {
  try {
    return new URL(value).hostname.split(".")[0];
  } catch {
    return "";
  }
}

async function listFiles(bucketApi, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucketApi.list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("A private bucket inventory could not be read.");
    for (const entry of data ?? []) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id || entry.metadata) files.push({ entry, key });
      else files.push(...await listFiles(bucketApi, key));
    }
    if (!data || data.length < 100) break;
  }
  return files;
}

async function main() {
  const output = assertOutsideRepository(argument("--output") ?? "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required in the process environment.");
  if (projectRefFromUrl(url) !== PRODUCTION_REF) fail("The backup source is not the approved Zevantaa Supabase project.");

  await mkdir(resolve(output, "objects"), { recursive: true });
  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const manifest = {
    format: "zevantaa-private-storage-backup-v1",
    projectRef: PRODUCTION_REF,
    createdAtUtc: new Date().toISOString(),
    buckets: [],
  };

  for (const bucket of BUCKETS) {
    const bucketApi = supabase.storage.from(bucket);
    const inventory = await listFiles(bucketApi);
    const objects = [];
    for (const { entry, key } of inventory.sort((a, b) => a.key.localeCompare(b.key))) {
      const { data, error } = await bucketApi.download(key);
      if (error || !data) throw new Error(`A private object in ${bucket} could not be backed up.`);
      const bytes = Buffer.from(await data.arrayBuffer());
      const objectId = createHash("sha256").update(`${bucket}\0${key}`).digest("hex");
      const relativePath = `objects/${bucket}/${objectId}.bin`;
      const target = resolve(output, relativePath);
      await mkdir(resolve(output, "objects", bucket), { recursive: true });
      await writeFile(target, bytes, { flag: "wx" });
      objects.push({
        key,
        backupPath: relativePath,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        contentType: entry.metadata?.mimetype ?? "application/octet-stream",
      });
    }
    manifest.buckets.push({ name: bucket, objectCount: objects.length, objects });
  }

  const manifestPath = resolve(output, "storage-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  for (const bucket of manifest.buckets) {
    for (const object of bucket.objects) {
      const bytes = await readFile(resolve(output, object.backupPath));
      if (bytes.length !== object.size || createHash("sha256").update(bytes).digest("hex") !== object.sha256) {
        throw new Error("A private Storage backup checksum did not verify.");
      }
    }
  }
  const manifestBytes = await readFile(manifestPath);
  const summary = {
    bucketCount: manifest.buckets.length,
    objectCount: manifest.buckets.reduce((total, bucket) => total + bucket.objectCount, 0),
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : "Private Storage backup failed."));
