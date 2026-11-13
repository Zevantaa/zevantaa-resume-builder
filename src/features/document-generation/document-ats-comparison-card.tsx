"use client";

import { useState } from "react";

import { ArrowRightIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui";

import type { DocumentAssessmentState, DocumentAtsComparisonView } from "./document-ats-comparison-service";

function stateLabel(state: DocumentAssessmentState): string {
  if (state.status === "ready") return `${state.score}/100`;
  if (state.status === "pending" || state.status === "processing") return "Assessment pending";
  if (state.status === "unavailable") return "Unavailable";
  if (state.status === "failed") return "Assessment failed";
  return "Not assessed";
}

function variant(state: DocumentAssessmentState["status"]): "success" | "warning" | "neutral" | "error" {
  return state === "ready" ? "success" : state === "failed" ? "error" :
    state === "pending" || state === "processing" ? "warning" : "neutral";
}

export function DocumentAtsComparisonCard({ comparison }: { comparison: DocumentAtsComparisonView | null }) {
  const [selectedId, setSelectedId] = useState(comparison?.variants[0]?.documentId ?? "");
  const selected = comparison?.variants.find((item) => item.documentId === selectedId) ?? comparison?.variants[0] ?? null;
  return <section aria-labelledby="document-ats-comparison-heading" className="document-ats-comparison dashboard-workspace-panel">
    <div className="dashboard-module-heading">
      <span className="type-label dashboard-kicker">Indicative ATS Assessment</span>
      <h2 className="type-heading-3" id="document-ats-comparison-heading">Original vs optimized resume</h2>
      <p className="type-supporting text-text-muted">Calculated from searchable text in the actual private documents. This is not a third-party ATS guarantee.</p>
    </div>
    {!comparison ? <p className="type-supporting">Document assessment data is unavailable.</p> : <>
      {comparison.variants.length > 1 && <label className="form-field" htmlFor="ats-resume-variant">
        <span className="type-label form-label">Compare generated resume</span>
        <select className="form-control" id="ats-resume-variant" onChange={(event) => setSelectedId(event.target.value)} value={selected?.documentId ?? ""}>
          {comparison.variants.map((item) => <option key={item.documentId} value={item.documentId}>{item.optimized.label} · v{item.optimized.version}</option>)}
        </select>
      </label>}
      {!selected ? <p className="type-supporting">No generated resume is available for comparison yet.</p> : <>
        <div className="document-ats-comparison__scores">
          <article><span>Original Resume</span><strong>{stateLabel(comparison.original)}</strong>
            <StatusBadge variant={variant(comparison.original.status)}>{comparison.original.status}</StatusBadge></article>
          <span aria-hidden="true" className="document-ats-comparison__arrow"><ArrowRightIcon /></span>
          <article><span>Optimized Resume</span><strong>{stateLabel(selected.optimized)}</strong>
            <small>{selected.optimized.label} · v{selected.optimized.version}</small>
            <StatusBadge variant={variant(selected.optimized.status)}>{selected.optimized.status}</StatusBadge></article>
          <article className="document-ats-comparison__delta"><span>Measured change</span>
            <strong>{selected.delta === null ? "—" : `${selected.delta >= 0 ? "+" : ""}${selected.delta} points`}</strong>
            <small>{selected.compatible ? "Same documented methodology" : "Waiting for compatible assessments"}</small></article>
        </div>
        {selected.compatible && <details className="document-ats-comparison__details">
          <summary className="type-button">View measurable criteria</summary>
          {selected.improvements.length ? <ul>{selected.improvements.map((item) => <li key={item.dimension}>
            <strong>{item.label}: {item.before} to {item.after} (+{item.delta}).</strong> {item.explanation}
          </li>)}</ul> : <p className="type-supporting">No measured dimension increased between these document versions.</p>}
          <p className="type-supporting text-text-muted">Methodology: {comparison.original.algorithmVersion}.</p>
        </details>}
      </>}
    </>}
  </section>;
}
