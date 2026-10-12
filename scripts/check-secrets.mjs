import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rules = [
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{12,}\b/g],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["payment live key", /\bsk_live_[A-Za-z0-9]{12,}\b/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
];
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
let findings = 0;
for (const file of files) {
  if (/^(?:node_modules|\.next)\//.test(file) || /\.(?:png|jpe?g|webp|pdf|docx?|woff2?|ico|zip)$/i.test(file)) continue;
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  if (content.includes("\0")) continue;
  for (const [label, expression] of rules) {
    expression.lastIndex = 0;
    if (expression.test(content)) {
      // Never echo the matching material into CI logs.
      process.stderr.write(`Potential ${label} in ${file}.\n`);
      findings++;
    }
  }
}
if (findings) process.exitCode = 1;
else process.stdout.write("No configured high-confidence secret patterns found in versioned or new non-ignored text files.\n");
