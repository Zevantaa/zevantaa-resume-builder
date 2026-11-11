import type { CSSProperties } from "react";

import { ArrowRightIcon } from "@/components/ui/icons";

import { ATS_ALGORITHM_VERSION, type IndicativeAtsScore } from "./indicative-ats-score";
import type { AtsAssessmentComparison } from "./ats-assessment-comparison";

export function IndicativeAtsPanel({ result, comparison = null }: {
  result: IndicativeAtsScore; comparison?: AtsAssessmentComparison | null;
}) {
  const scoreStyle = result.status === "ready"
    ? { "--ats-progress": `${result.score * 3.6}deg` } as CSSProperties
    : undefined;

  return <section aria-labelledby="indicative-ats-heading" className="dashboard-ats-band dashboard-ats-panel">
    <div className="dashboard-ats-copy">
      <span className="type-label">Global ATS resume: internal indicator</span>
      <h2 className="type-heading-3" id="indicative-ats-heading">Indicative ATS Score</h2>
      <p className="type-supporting">Internal optimization indicator; not a third-party ATS guarantee.</p>
      {result.status === "ready" ? <>
        <p className="type-supporting"><strong>Target: {result.benchmark}</strong>: {result.band === "meets-benchmark" ? "Meets benchmark" : result.band === "near-benchmark" ? "Near benchmark" : "Below benchmark"}</p>
        <p className="type-supporting">Calculation provenance: {ATS_ALGORITHM_VERSION}.</p>
        <details className="dashboard-ats-details">
          <summary className="type-button">View score breakdown and suggestions</summary>
          <dl className="dashboard-ats-breakdown">
            {result.breakdown.map((item) => <div key={item.dimension}>
              <dt>{item.label}</dt><dd>{item.score}/{item.maximum}</dd>
              <dd className="dashboard-ats-meter"><meter aria-label={`${item.label} score`} max={item.maximum} min={0} value={item.score}>{item.score} of {item.maximum}</meter></dd>
              <dd className="type-supporting">{item.reason}</dd>
            </div>)}
          </dl>
          {result.suggestions.length ? <div className="type-supporting"><strong>Possible improvements</strong><ul>
            {result.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
          </ul></div> : null}
        </details>
        {comparison && <details className="dashboard-ats-details">
          <summary className="type-button">View recorded before-and-after assessment</summary>
          <p className="type-supporting"><strong>{comparison.before.score}/100 <ArrowRightIcon className="ui-icon--inline" /> {comparison.after.score}/100</strong> across saved career revisions {comparison.before.revision} and {comparison.after.revision}.</p>
          <p className="type-supporting">Algorithm: {comparison.algorithmVersion}. Scores are genuine calculations from the saved canonical profile at each revision.</p>
          {comparison.improvements.length ? <ul className="type-supporting">{comparison.improvements.map((item) =>
            <li key={item.dimension}><strong>{item.label}: {item.before} <ArrowRightIcon className="ui-icon--inline" /> {item.after} (+{item.delta}).</strong> {item.explanation}</li>)}</ul>
            : <p className="type-supporting">No measured criterion increased between these two recorded revisions.</p>}
        </details>}
      </> : <>
        <p className="type-supporting"><strong>Not ready</strong>: Target {result.benchmark}</p>
        <ul className="type-supporting">{result.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul>
      </>}
    </div>
    <div
      aria-label={result.status === "ready" ? `Indicative ATS score ${result.score} out of 100` : "Indicative ATS score not ready"}
      aria-valuemax={result.status === "ready" ? 100 : undefined}
      aria-valuemin={result.status === "ready" ? 0 : undefined}
      aria-valuenow={result.status === "ready" ? result.score : undefined}
      className="dashboard-ats-score"
      data-state={result.status}
      role={result.status === "ready" ? "progressbar" : "status"}
      style={scoreStyle}
    >
      <strong>{result.status === "ready" ? result.score : <>&mdash;</>}</strong><span>{result.status === "ready" ? "/100" : "Not ready"}</span>
    </div>
  </section>;
}
