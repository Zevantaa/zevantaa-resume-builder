"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { InlineAlert } from "@/components/ui";

import { generatePdfForQaAction } from "./generate-pdf-for-qa-action";
import type { PdfRenderQaScenario } from "./pdf-render-qa-types";

const options: readonly { scenario: PdfRenderQaScenario; label: string; description: string }[] = [
  { scenario: "one-page", label: "Generate 1-page PDF", description: "Concise fictional identity, summary, employment, education, and skills." },
  { scenario: "multi-page", label: "Generate multi-page PDF", description: "Long entries, wrapped bullets, automatic page flow, and an explicit break." },
  { scenario: "unicode", label: "Generate Unicode/font test PDF", description: "English and Devanagari text for visual and copy/search checks." },
];

type GeneratedPdf = { url: string; filename: string };

export function PdfRenderQaPanel() {
  const [generated, setGenerated] = useState<Partial<Record<PdfRenderQaScenario, GeneratedPdf>>>({});
  const [active, setActive] = useState<PdfRenderQaScenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function generate(scenario: PdfRenderQaScenario) {
    setActive(scenario);
    setError(null);
    startTransition(async () => {
      try {
        const result = await generatePdfForQaAction(scenario);
        const bytes = Uint8Array.from(atob(result.base64), (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        objectUrls.current.push(url);
        setGenerated((previous) => ({ ...previous, [scenario]: { url, filename: result.filename } }));
      } catch {
        setError("The QA PDF could not be generated. Check your admin session and try again.");
      } finally {
        setActive(null);
      }
    });
  }

  return (
    <div className="dashboard-section layout-stack" aria-label="PDF renderer QA controls">
      {options.map(({ scenario, label, description }) => (
        <section className="dashboard-workspace-panel" key={scenario}>
          <div className="dashboard-module-heading">
            <h2 className="type-heading-3">{label.replace("Generate ", "")}</h2>
            <p className="type-supporting text-text-muted">{description}</p>
          </div>
          <button className="auth-submit type-button" type="button" onClick={() => generate(scenario)} disabled={isPending}>
            {isPending && active === scenario ? "Generating…" : label}
          </button>
          {generated[scenario] && (
            <p className="type-body">
              <a href={generated[scenario].url} target="_blank" rel="noopener noreferrer">Open PDF</a>
              {" · "}
              <a href={generated[scenario].url} download={generated[scenario].filename}>Download PDF</a>
            </p>
          )}
        </section>
      ))}
      <p className="type-supporting text-text-muted" role="status" aria-live="polite">
        {isPending ? "Generating a temporary PDF…" : "PDFs are generated in memory and are not saved to your account."}
      </p>
      {error && <InlineAlert variant="error">{error}</InlineAlert>}
    </div>
  );
}
