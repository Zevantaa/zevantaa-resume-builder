"use server";

import { requireApplicationRole } from "@/features/authentication/authorization";

import { createPdfRenderQaModel } from "./pdf-render-qa-fixtures";
import type { PdfRenderQaResult, PdfRenderQaScenario } from "./pdf-render-qa-types";
import { renderPdfDocument } from "./render-pdf";

const scenarios: readonly PdfRenderQaScenario[] = ["one-page", "multi-page", "unicode"];

export async function generatePdfForQaAction(scenario: PdfRenderQaScenario): Promise<PdfRenderQaResult> {
  await requireApplicationRole("admin");
  if (!scenarios.includes(scenario)) throw new Error("Unsupported PDF QA scenario.");

  const pdf = await renderPdfDocument(createPdfRenderQaModel(scenario));
  return { base64: pdf.toString("base64"), filename: `development-qa-${scenario}.pdf` };
}
