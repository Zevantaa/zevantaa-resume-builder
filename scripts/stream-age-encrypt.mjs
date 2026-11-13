import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function argumentsFor(name) {
  return process.argv.flatMap((value, index) => value === name && process.argv[index + 1] ? [process.argv[index + 1]] : []);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function main() {
  const root = resolve(process.cwd());
  const output = resolve(argument("--output") ?? "");
  const fromRoot = relative(root, output);
  const recipients = argumentsFor("--recipient");
  const ageBinary = argument("--age-binary") ?? "age";
  if (!isAbsolute(output) || fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot)) || !output.endsWith(".age")) {
    fail("Encrypted output must be an absolute .age path outside the repository.");
  }
  if (recipients.length < 2 || recipients.some((recipient) => !recipient.startsWith("age1pq1")) || new Set(recipients).size !== recipients.length) {
    fail("Distinct local and offline post-quantum age recipients are required.");
  }
  await mkdir(dirname(output), { recursive: true });
  try {
    await stat(output);
    fail("Encrypted output already exists.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const ageArguments = ["--encrypt"];
  for (const recipient of recipients) ageArguments.push("--recipient", recipient);
  ageArguments.push("--output", output, "-");
  const age = spawn(ageBinary, ageArguments, {
    stdio: ["pipe", "ignore", "pipe"], windowsHide: true,
  });
  age.stderr.resume();
  const exit = new Promise((resolveExit) => age.once("close", resolveExit));
  try {
    await pipeline(process.stdin, age.stdin);
    if (await exit !== 0) throw new Error("age encryption failed.");
    const details = await stat(output);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(output)) hash.update(chunk);
    process.stdout.write(`${JSON.stringify({ encryptedBytes: details.size, ciphertextSha256: hash.digest("hex") })}\n`);
  } catch (error) {
    age.kill();
    await unlink(output).catch(() => {});
    throw error;
  }
}

main().catch(() => fail("Authenticated encryption failed without retaining plaintext."));
