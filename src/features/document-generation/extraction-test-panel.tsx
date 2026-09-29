"use client";

import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/ui";

import { extractResumeForQaAction } from "./extract-resume-for-qa-action";
import type { ExtractionTestOutcome } from "./extraction-test-types";

const failureMessages: Record<NonNullable<ExtractionTestOutcome["failureReason"]>, string> = {
  "unsupported-format": "This file format cannot be extracted.",
  "invalid-file": "The file does not match its recorded format or size.",
  "corrupt-file": "The file is malformed or could not be read safely.",
  "encrypted-file": "This PDF is encrypted and cannot be extracted.",
  "active-content": "This document contains unsupported active content.",
  "extraction-limit": "The file exceeds the extraction safety limits.",
  "insufficient-text": "No usable text was found. Scanned PDFs need manual review; OCR is not available.",
  "source-unavailable": "No available source resume could be found for this profile.",
  "unsafe-storage-reference": "The private source file reference could not be verified.",
};

export function ExtractionTestPanel() {
  const [result, setResult] = useState<ExtractionTestOutcome | null>(null);
  const [requestError, setRequestError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function runExtraction() {
    setResult(null);
    setRequestError(false);
    startTransition(async () => {
      try {
        setResult(await extractResumeForQaAction());
      } catch {
        setRequestError(true);
      }
    });
  }

  return (
    <section className="dashboard-section" aria-label="Extraction QA result">
      <button className="auth-submit extraction-test-button type-button" type="button" onClick={runExtraction} disabled={isPending}>
        {isPending ? "Extracting…" : "Extract resume text"}
      </button>
      <p className="type-supporting text-text-muted" role="status" aria-live="polite">
        {isPending ? "Reading your private source resume…" : result ? `Extraction status: ${result.status}` : "Extraction has not run yet."}
      </p>
      {requestError && <InlineAlert variant="error">Extraction could not be started. Please try again.</InlineAlert>}
      {result && (
        <div className="dashboard-section">
          <dl className="dashboard-detail-list">
            <div><dt>Extractor used</dt><dd>{result.extractor ?? "None"}</dd></div>
            {result.pageCount !== null && <div><dt>Page count</dt><dd>{result.pageCount}</dd></div>}
            {result.failureReason && <div><dt>Failure reason</dt><dd>{failureMessages[result.failureReason]}</dd></div>}
          </dl>
          {result.warnings.length > 0 && (
            <div>
              <h2 className="type-heading-4">Warnings</h2>
              <ul className="extraction-test-warnings">
                {result.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{warning.message}</li>)}
              </ul>
            </div>
          )}
          {result.preview !== null && (
            <div className="dashboard-section">
              <h2 className="type-heading-4">Normalized text preview</h2>
              <pre className="extraction-test-preview" aria-label="Read-only extracted text preview">{result.preview}</pre>
              {result.previewTruncated && <p className="type-supporting text-text-muted">Preview limited to the first 12,000 characters.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
