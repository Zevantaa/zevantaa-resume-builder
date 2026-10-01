import type { IndicativeAtsScore } from "./indicative-ats-score";

export function IndicativeAtsPanel({ result }: { result: IndicativeAtsScore }) {
  return <section aria-labelledby="indicative-ats-heading" className="dashboard-ats-band dashboard-ats-panel">
    <div className="dashboard-ats-copy">
      <span className="type-label">Global ATS resume · internal indicator</span>
      <h2 className="type-heading-3" id="indicative-ats-heading">Indicative ATS Score</h2>
      <p className="type-supporting">Internal optimization indicator; not a third-party ATS guarantee.</p>
      {result.status === "ready" ? <>
        <p className="type-supporting"><strong>Target: {result.benchmark}</strong> · {result.band === "meets-benchmark" ? "Meets benchmark" : result.band === "near-benchmark" ? "Near benchmark" : "Below benchmark"}</p>
        <details className="dashboard-ats-details">
          <summary className="type-button">View score breakdown and suggestions</summary>
          <dl className="dashboard-ats-breakdown">
            {result.breakdown.map((item) => <div key={item.dimension}>
              <dt>{item.label}</dt><dd>{item.score}/{item.maximum}</dd>
              <dd className="type-supporting">{item.reason}</dd>
            </div>)}
          </dl>
          {result.suggestions.length ? <div className="type-supporting"><strong>Possible improvements</strong><ul>
            {result.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
          </ul></div> : null}
        </details>
      </> : <>
        <p className="type-supporting"><strong>Not ready</strong> · Target: {result.benchmark}</p>
        <ul className="type-supporting">{result.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul>
      </>}
    </div>
    <div aria-label={result.status === "ready" ? `Indicative ATS score ${result.score} out of 100` : "Indicative ATS score not ready"} className="dashboard-ats-score">
      {result.status === "ready" ? result.score : "—"}<span>{result.status === "ready" ? "/100" : "Not ready"}</span>
    </div>
  </section>;
}
