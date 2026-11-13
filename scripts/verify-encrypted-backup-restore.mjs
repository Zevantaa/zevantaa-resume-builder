import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const BUCKETS = new Set(["candidate-intake-private", "candidate-documents-private", "zevantaa-brand-assets"]);
const PRODUCTION_REF = "fzltowzpfrnuxxxrzuih";
const DATABASE_FILES = [
  "roles.sql.age", "managed-schema.sql.age", "schema.sql.age",
  "history-schema.sql.age", "data.sql.age", "history-data.sql.age",
];

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readIdentity() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 128 * 1024) throw new Error("The age identity input exceeded the safe limit.");
    chunks.push(chunk);
  }
  const identity = Buffer.concat(chunks);
  if (!identity.toString("utf8").includes("AGE-SECRET-KEY-PQ-1")) throw new Error("A post-quantum age identity is required.");
  return identity;
}

function resolveEncrypted(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath.endsWith(".age")) throw new Error("An encrypted backup path is invalid.");
  const target = resolve(root, relativePath);
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error("An encrypted backup path escaped its root.");
  return target;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function findProperty(value, name) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProperty(item, name);
      if (found !== undefined) return found;
    }
  } else if (value && typeof value === "object") {
    if (Object.hasOwn(value, name)) return value[name];
    for (const item of Object.values(value)) {
      const found = findProperty(item, name);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function collect(stream, limit = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) throw new Error("A decrypted metadata stream exceeded its safe limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function startAge(ageBinary, encryptedPath, identity) {
  const age = spawn(ageBinary, ["--decrypt", "--identity", "-", encryptedPath], {
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  age.stderr.resume();
  age.stdin.on("error", () => {});
  age.exitPromise = once(age, "close");
  age.stdin.end(identity);
  return age;
}

async function decryptBuffer(ageBinary, encryptedPath, identity, limit) {
  const age = startAge(ageBinary, encryptedPath, identity);
  const output = await collect(age.stdout, limit);
  const [code] = await age.exitPromise;
  if (code !== 0) throw new Error("An age artifact failed authenticated decryption.");
  return output;
}

async function writeStream(destination, source) {
  for await (const chunk of source) {
    if (!destination.write(chunk)) await once(destination, "drain");
  }
}

async function restoreDatabase({ ageBinary, dockerBinary, container, root, identity }) {
  const psql = spawn(dockerBinary, [
    "exec", "-i", container, "psql", "--username", "supabase_admin", "--dbname", "postgres",
    "--single-transaction", "--variable", "ON_ERROR_STOP=1",
  ], { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
  psql.stderr.resume();
  psql.stdin.on("error", () => {});
  const psqlExit = once(psql, "close");
  try {
    for (const file of DATABASE_FILES) {
      const age = startAge(ageBinary, resolveEncrypted(root, file), identity);
      await writeStream(psql.stdin, age.stdout);
      const [ageCode] = await age.exitPromise;
      if (ageCode !== 0) throw new Error("A database artifact failed authenticated decryption.");
      psql.stdin.write("\n");
    }
    psql.stdin.end();
    const [psqlCode] = await psqlExit;
    if (psqlCode !== 0) throw new Error("The memory-backed PostgreSQL restore failed.");
  } catch (error) {
    psql.kill();
    throw error;
  }
}

async function querySnapshot(dockerBinary, container, snapshotSql) {
  const psql = spawn(dockerBinary, [
    "exec", "-i", container, "psql", "--username", "supabase_admin", "--dbname", "postgres",
    "--tuples-only", "--no-align", "--variable", "ON_ERROR_STOP=1",
  ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  psql.stderr.resume();
  psql.stdin.on("error", () => {});
  const psqlExit = once(psql, "close");
  psql.stdin.end(await readFile(snapshotSql));
  const output = await collect(psql.stdout, 1024 * 1024);
  const [code] = await psqlExit;
  if (code !== 0) throw new Error("The restored database snapshot query failed.");
  return JSON.parse(output.toString("utf8").trim());
}

async function restoreObject({ ageBinary, dockerBinary, container, encryptedPath, identity, objectId }) {
  if (!/^[a-f0-9]{64}$/.test(objectId)) throw new Error("A Storage object identifier is invalid.");
  const command = 'set -eu; p="/restore/$1"; cat > "$p"; sha256sum "$p"; wc -c < "$p"; sha256sum "$p"; rm -f "$p"';
  const target = spawn(dockerBinary, ["exec", "-i", container, "sh", "-c", command, "sh", objectId], {
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  target.stderr.resume();
  target.stdin.on("error", () => {});
  const targetExit = once(target, "close");
  const age = startAge(ageBinary, encryptedPath, identity);
  try {
    await writeStream(target.stdin, age.stdout);
    target.stdin.end();
    const [[ageCode], output, [targetCode]] = await Promise.all([
      age.exitPromise, collect(target.stdout, 1024 * 1024), targetExit,
    ]);
    if (ageCode !== 0 || targetCode !== 0) throw new Error("A Storage object failed memory-backed restore.");
    const lines = output.toString("utf8").trim().split(/\r?\n/);
    return { firstHash: lines[0]?.split(/\s+/)[0], size: Number(lines[1]), secondHash: lines[2]?.split(/\s+/)[0] };
  } catch (error) {
    age.kill();
    target.kill();
    throw error;
  }
}

async function main() {
  if (!process.argv.includes("--confirm-memory-only-target")) fail("Explicit memory-only restore confirmation is required.");
  const root = resolve(argument("--backup-root") ?? "");
  const container = argument("--container") ?? "";
  const ageBinary = argument("--age-binary") ?? "age";
  const dockerBinary = argument("--docker-binary") ?? "docker";
  const snapshotSql = resolve(argument("--snapshot-sql") ?? "");
  if (!isAbsolute(root) || !container.startsWith("zevantaa-encrypted-restore-")) fail("The isolated restore target is invalid.");
  const identity = await readIdentity();
  try {
    await restoreDatabase({ ageBinary, dockerBinary, container, root, identity });
    const sourceBuffer = await decryptBuffer(ageBinary, resolveEncrypted(root, "source-counts.json.age"), identity, 1024 * 1024);
    const sourceEnvelope = JSON.parse(sourceBuffer.toString("utf8"));
    sourceBuffer.fill(0);
    const sourceSnapshot = findProperty(sourceEnvelope, "release_snapshot") ?? sourceEnvelope;
    const localSnapshotEnvelope = await querySnapshot(dockerBinary, container, snapshotSql);
    const localSnapshot = findProperty(localSnapshotEnvelope, "release_snapshot") ?? localSnapshotEnvelope;
    if (JSON.stringify(canonicalJson(localSnapshot)) !== JSON.stringify(canonicalJson(sourceSnapshot))) {
      throw new Error("Restored database counts do not match production backup evidence.");
    }

    const manifestBuffer = await decryptBuffer(ageBinary, resolveEncrypted(root, "private-storage/storage-manifest.json.age"), identity, 16 * 1024 * 1024);
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    manifestBuffer.fill(0);
    if (manifest.projectRef !== PRODUCTION_REF || manifest.format !== "zevantaa-private-storage-backup-v2-age") {
      throw new Error("The encrypted Storage manifest is not an approved Zevantaa backup.");
    }
    let restoredObjectCount = 0;
    let restoredBytes = 0;
    for (const bucket of manifest.buckets ?? []) {
      if (!BUCKETS.has(bucket.name)) throw new Error("The Storage manifest contains an unexpected bucket.");
      for (const object of bucket.objects ?? []) {
        const encryptedPath = resolveEncrypted(resolve(root, "private-storage"), object.encryptedPath);
        const result = await restoreObject({ ageBinary, dockerBinary, container, encryptedPath, identity, objectId: object.objectId });
        if (result.size !== object.size || result.firstHash !== object.sha256 || result.secondHash !== object.sha256) {
          throw new Error("A restored private Storage object failed byte-for-byte verification.");
        }
        restoredObjectCount += 1;
        restoredBytes += result.size;
      }
    }
    if (restoredObjectCount !== Number(sourceSnapshot.private_storage_objects)) {
      throw new Error("Storage manifest objects do not match restored database metadata counts.");
    }
    process.stdout.write(`${JSON.stringify({
      databaseSnapshotMatched: true,
      bucketCount: BUCKETS.size,
      restoredObjectCount,
      restoredBytes,
      plaintextPersistentWrites: 0,
    })}\n`);
  } finally {
    identity.fill(0);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : "Encrypted restore verification failed."));
