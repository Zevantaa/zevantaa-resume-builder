import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const portal of ["admin", "client"]) {
  test(`${portal} portal renders at request time and retains its role guard`, () => {
    const layout = readFileSync(new URL(`../src/app/${portal}/layout.tsx`, import.meta.url), "utf8");
    assert.match(layout, /export const dynamic = "force-dynamic";/);
    assert.match(layout, new RegExp(`Promise\\.all\\(\\[\\s*requireApplicationRole\\("${portal}"\\),\\s*getBrandSettings\\(\\)`));
  });
}
