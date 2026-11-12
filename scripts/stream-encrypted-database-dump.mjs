import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

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

function assertOutsideRepository(pathValue) {
  const root = resolve(process.cwd());
  const target = resolve(pathValue ?? "");
  const fromRoot = relative(root, target);
  if (!pathValue || !isAbsolute(target) || fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))) {
    fail("Encrypted database output must be an absolute path outside the Git repository.");
  }
  if (!target.endsWith(".age")) fail("Encrypted database output must use the .age extension.");
  return target;
}

async function readStdin(limit = 1024 * 1024) {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > limit) throw new Error("The Supabase dump plan exceeded the safe in-memory limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function validatePlan(plan) {
  const scriptAt = plan.indexOf("#!/usr/bin/env bash");
  if (scriptAt < 0) throw new Error("The official Supabase dump plan was not recognized.");
  const script = plan.slice(scriptAt);
  const host = script.match(/^export PGHOST="([^"]+)"$/m)?.[1] ?? "";
  const user = script.match(/^export PGUSER="([^"]+)"$/m)?.[1] ?? "";
  const database = script.match(/^export PGDATABASE="([^"]+)"$/m)?.[1] ?? "";
  if (!host.endsWith(".supabase.com") || database !== "postgres") {
    throw new Error("The dump plan does not target an approved Supabase Postgres endpoint.");
  }
  if (user !== "postgres" && user !== `postgres.${PRODUCTION_REF}`) {
    throw new Error("The dump plan does not target the approved Zevantaa database user.");
  }
  if (!script.includes(PRODUCTION_REF) && !host.startsWith(`db.${PRODUCTION_REF}.`)) {
    throw new Error("The dump plan is not bound to the approved Zevantaa project.");
  }
  if (!/\bpg_dump(?:all)?\b/.test(script) || !script.includes('echo "RESET ALL;"')) {
    throw new Error("The dump plan is missing required Supabase backup operations.");
  }
  return script;
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  const output = assertOutsideRepository(argument("--output"));
  const recipients = argumentsFor("--recipient");
  const ageBinary = argument("--age-binary") ?? "age";
  const dockerBinary = argument("--docker-binary") ?? "docker";
  const image = argument("--postgres-image") ?? "";
  if (recipients.length < 2 || recipients.some((recipient) => !recipient.startsWith("age1pq1")) || new Set(recipients).size !== recipients.length) {
    fail("Distinct local and offline post-quantum age recipients are required.");
  }
  if (image !== "public.ecr.aws/supabase/postgres:17.11.0.018") fail("The approved pinned Supabase Postgres image is required.");
  await mkdir(dirname(output), { recursive: true });
  try {
    await stat(output);
    fail("Encrypted database output already exists.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const plan = await readStdin();
  const script = validatePlan(plan);
  const docker = spawn(dockerBinary, [
    "run", "--rm", "-i", "--network", "bridge", "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", image, "bash", "-s",
  ], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const ageArguments = ["--encrypt"];
  for (const recipient of recipients) ageArguments.push("--recipient", recipient);
  ageArguments.push("--output", output, "-");
  const age = spawn(ageBinary, ageArguments, {
    stdio: ["pipe", "ignore", "pipe"],
    windowsHide: true,
  });
  let dockerError = "";
  let ageError = "";
  docker.stderr.setEncoding("utf8");
  age.stderr.setEncoding("utf8");
  docker.stderr.on("data", (value) => { if (dockerError.length < 65536) dockerError += value; });
  age.stderr.on("data", (value) => { if (ageError.length < 65536) ageError += value; });
  const dockerExit = new Promise((resolveExit) => docker.once("close", resolveExit));
  const ageExit = new Promise((resolveExit) => age.once("close", resolveExit));
  const encrypted = pipeline(docker.stdout, age.stdin);
  docker.stdin.end(script);

  try {
    await encrypted;
    const [dockerCode, ageCode] = await Promise.all([dockerExit, ageExit]);
    if (dockerCode !== 0 || ageCode !== 0) {
      throw new Error("The authenticated database stream did not complete successfully.");
    }
    const details = await stat(output);
    if (details.size < 200) throw new Error("The encrypted database artifact is unexpectedly small.");
    process.stdout.write(`${JSON.stringify({ encryptedBytes: details.size, ciphertextSha256: await hashFile(output) })}\n`);
  } catch (error) {
    docker.kill();
    age.kill();
    await unlink(output).catch(() => {});
    throw error;
  } finally {
    dockerError = "";
    ageError = "";
  }
}

main().catch(() => fail("Encrypted database streaming failed without writing a plaintext dump."));
