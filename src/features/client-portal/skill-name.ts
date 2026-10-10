/** Deterministic display and deduplication rules; never infer a skill from context. */
export function normalizeSkillName(value: string): { name: string; key: string } {
  const compact = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const folded = compact.toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, "");
  if (["excel", "msexcel", "microsoftexcel"].includes(folded)) {
    return { name: "Microsoft Excel", key: "microsoft-excel" };
  }
  return { name: compact, key: compact.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/gu, "") };
}
