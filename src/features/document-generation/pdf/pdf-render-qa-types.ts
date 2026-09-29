export type PdfRenderQaScenario = "one-page" | "multi-page" | "unicode" | "header-footer";

export interface PdfRenderQaResult {
  base64: string;
  filename: string;
}
