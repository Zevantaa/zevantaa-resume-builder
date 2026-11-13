"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";
import { assertQaUtilitiesEnabled } from "../../lib/qa-utilities";

import { extractCurrentClientSourceResume } from "./current-client-resume-service";
import type { ExtractionTestOutcome } from "./extraction-test-types";

const PREVIEW_LIMIT = 12_000;

export async function extractResumeForQaAction(): Promise<ExtractionTestOutcome> {
  assertQaUtilitiesEnabled();
  await requireApplicationRole("client");

  // The extractor resolves the active client's linked file and private object key.
  // Never send raw text or storage metadata to the browser.
  const result = await extractCurrentClientSourceResume();
  const normalizedText = result.normalizedText;

  return {
    status: result.status,
    extractor: result.extractor,
    pageCount: result.pageCount,
    warnings: result.warnings,
    failureReason: result.failureReason,
    preview: normalizedText?.slice(0, PREVIEW_LIMIT) ?? null,
    previewTruncated: normalizedText !== null && normalizedText.length > PREVIEW_LIMIT,
  };
}
