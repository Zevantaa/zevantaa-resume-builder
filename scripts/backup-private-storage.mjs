import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["candidate-intake-private", "candidate-documents-private", "zevantaa-brand-assets"];
const PRODUCTION_REF = "fzltowzpfrnuxxxrzuih";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function argumentsFor(name) {
  return process.argv.flatMap((value, index) => value === name && process.argv[index + 1] ? [process.argv[index + 1]] : []);
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
  try { return new URL(value).hostname.split(".")[0]; } catch { return ""; }
}

async function listFiles(bucketApi, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucketApi.list(prefix, {
      limit: 100, offset, sortBy: { column: "name", order: "asc" },
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

async function encryptBytes(bytes, target, recipients, ageBinary) {
  try {
    await stat(target);
    throw new Error("An encrypted Storage artifact already exists.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const ageArguments = ["--encrypt"];
  for (const recipient of recipients) ageArguments.push("--recipient", recipient);
  ageArguments.push("--output", target, "-");
  const age = spawn(ageBinary, ageArguments, {
    stdio: ["pipe", "ignore", "pipe"], windowsHide: true,
  });
  age.stderr.resume();
  const exit = new Promise((resolveExit) => age.once("close", resolveExit));
  try {
    age.stdin.end(bytes);
    if (await exit !== 0) throw new Error("Authenticated Storage encryption failed.");
  } catch (error) {
    age.kill();
    await unlink(target).catch(() => {});
    throw error;
  }
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  const output = assertOutsideRepository(argument("--output") ?? "");
  const recipients = argumentsFor("--recipient");
  const ageBinary = argument("--age-binary") ?? "age";
  if (recipients.length < 2 || recipients.some((recipient) => !recipient.startsWith("age1pq1")) || new Set(recipients).size !== recipients.length) {
    fail("Distinct local and offline post-quantum age recipients are required.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required in the process environment.");
  if (projectRefFromUrl(url) !== PRODUCTION_REF) fail("The backup source is not the approved Zevantaa Supabase project.");

  await mkdir(resolve(output, "objects"), { recursive: true });
  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const manifest = {
    format: "zevantaa-private-storage-backup-v2-age",
    projectRef: PRODUCTION_REF,
    createdAtUtc: new Date().toISOString(),
    buckets: [],
  };
  let totalBytes = 0;

  for (const bucket of BUCKETS) {
    const bucketApi = supabase.storage.from(bucket);
    const inventory = await listFiles(bucketApi);
    const objects = [];
    for (const { entry, key } of inventory.sort((a, b) => a.key.localeCompare(b.key))) {
      const { data, error } = await bucketApi.download(key);
      if (error || !data) throw new Error(`A private object in ${bucket} could not be backed up.`);
      const bytes = Buffer.from(await data.arrayBuffer());
      try {
        const objectId = createHash("sha256").update(`${bucket}\0${key}`).digest("hex");
        const encryptedPath = `objects/${bucket}/${objectId}.age`;
        const target = resolve(output, encryptedPath);
        await mkdir(resolve(output, "objects", bucket), { recursive: true });
        await encryptBytes(bytes, target, recipients, ageBinary);
        const ciphertext = await stat(target);
        objects.push({
          key, objectId, encryptedPath,
          size: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          ciphertextSize: ciphertext.size,
          ciphertextSha256: await hashFile(target),
          contentType: entry.metadata?.mimetype ?? "application/octet-stream",
        });
        totalBytes += bytes.length;
      } finally {
        bytes.fill(0);
      }
    }
    manifest.buckets.push({ name: bucket, objectCount: objects.length, objects });
  }

  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
  const manifestPath = resolve(output, "storage-manifest.json.age");
  try { await encryptBytes(manifestBytes, manifestPath, recipients, ageBinary); }
  finally { manifestBytes.fill(0); }
  const manifestCiphertext = await stat(manifestPath);
  process.stdout.write(`${JSON.stringify({
    bucketCount: manifest.buckets.length,
    objectCount: manifest.buckets.reduce((total, bucket) => total + bucket.objectCount, 0),
    plaintextObjectBytes: totalBytes,
    manifestCiphertextBytes: manifestCiphertext.size,
    manifestCiphertextSha256: await hashFile(manifestPath),
  })}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : "Private Storage backup failed."));
