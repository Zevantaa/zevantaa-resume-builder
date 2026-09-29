export type PdfRenderQaScenario = "one-page" | "multi-page" | "unicode";

export interface PdfRenderQaResult {
  base64: string;
  filename: string;
}
