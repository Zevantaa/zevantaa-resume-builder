"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui";
import type { EducationEntry } from "@/types/client-profile";
import type { CefrAssessment, CefrLevel, GlobalAtsMarket, RegionalIntake } from "@/types/regional-intake";

import { saveRegionalIntakeAction, type RegionalActionState } from "./save-regional-intake-action";

const initialState: RegionalActionState = { status: "idle", message: "" };
const markets: { value: GlobalAtsMarket; label: string }[] = [
  { value: "india", label: "India" }, { value: "global-mnc", label: "Global MNC" },
  { value: "usa", label: "USA" }, { value: "canada", label: "Canada" },
  { value: "uk", label: "UK" }, { value: "australia", label: "Australia" },
];
const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const axes: { key: keyof Omit<CefrAssessment, "language">; label: string }[] = [
  { key: "listening", label: "Listening" }, { key: "reading", label: "Reading" },
  { key: "spokenInteraction", label: "Spoken interaction" },
  { key: "spokenProduction", label: "Spoken production" }, { key: "writing", label: "Writing" },
];

function Text({ id, label, value, onChange, max = 200 }: {
  id: string; label: string; value?: string; onChange: (value: string) => void; max?: number;
}) {
  return <label className="regional-field" htmlFor={id}><span>{label}</span>
    <input id={id} maxLength={max} onChange={(event) => onChange(event.target.value)} type="text" value={value ?? ""} />
  </label>;
}

const lines = (values?: string[]) => values?.join("\n") ?? "";
const splitLines = (value: string) => value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);

export function ClientRegionalIntakeEditor({ initial, revision, education, gccEnabled, euEnabled }: {
  initial?: RegionalIntake; revision: number; education: EducationEntry[];
  gccEnabled: boolean; euEnabled: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<RegionalIntake>(initial ?? { version: 1 });
  const targetMarket = draft.global?.market;
  const showNotice = targetMarket === "india" || targetMarket === "global-mnc" || Boolean(draft.global?.noticePeriod);
  const showWorkAuthorization = targetMarket === "global-mnc" || targetMarket === "usa" ||
    targetMarket === "canada" || targetMarket === "uk" || targetMarket === "australia" ||
    Boolean(draft.global?.workAuthorization);
  const [state, action, pending] = useActionState(saveRegionalIntakeAction, initialState);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state.status, state.savedAt]);
  const setGlobal = (change: Partial<NonNullable<RegionalIntake["global"]>>) =>
    setDraft((current) => ({ ...current, global: { ...current.global, ...change } }));
  const setGcc = (change: Partial<NonNullable<RegionalIntake["gcc"]>>) =>
    setDraft((current) => ({ ...current, gcc: { ...current.gcc, ...change } }));
  const setEu = (change: Partial<NonNullable<RegionalIntake["eu"]>>) =>
    setDraft((current) => ({ ...current, eu: { ...current.eu, ...change } }));
  const setCefr = (index: number, change: Partial<CefrAssessment>) => {
    const rows = [...(draft.eu?.cefr ?? [])]; rows[index] = { ...rows[index], ...change };
    setEu({ cefr: rows });
  };
  const addCefr = () => setEu({ cefr: [...(draft.eu?.cefr ?? []), {
    language: "", listening: "A1", reading: "A1", spokenInteraction: "A1", spokenProduction: "A1", writing: "A1",
  }] });
  return <form action={action} className="layout-stack regional-intake-form">
    <input name="revision" type="hidden" value={revision} />
    <input name="regionalData" type="hidden" value={JSON.stringify(draft)} />
    {state.message && <InlineAlert variant={state.status === "success" ? "success" : "error"}>{state.message}</InlineAlert>}
    <section className="regional-intake-card" aria-labelledby="global-heading">
      <h2 id="global-heading">Global ATS target</h2>
      <p>Choose one target market. These confirmed facts feed the existing Global ATS resume and a separate keyword comparison.</p>
      <label className="regional-field" htmlFor="global-market"><span>Target market</span>
        <select id="global-market" value={draft.global?.market ?? ""} onChange={(event) => setGlobal({ market: event.target.value as GlobalAtsMarket || undefined })}>
          <option value="">Not specified</option>{markets.map((market) =>
            <option key={market.value} value={market.value}>{market.label}</option>)}
        </select>
      </label>
      <div className="regional-field-grid">
        <Text id="target-title" label="Target job title" value={draft.global?.targetJobTitle} onChange={(value) => setGlobal({ targetJobTitle: value })} />
        {showNotice && <Text id="global-notice" label="Verified notice period (optional)" value={draft.global?.noticePeriod} onChange={(value) => setGlobal({ noticePeriod: value })} />}
        {showWorkAuthorization && <Text id="global-rights" label="Verified work authorization (optional)" value={draft.global?.workAuthorization} onChange={(value) => setGlobal({ workAuthorization: value })} />}
      </div>
      <label className="regional-field" htmlFor="job-description"><span>Target job description</span>
        <textarea id="job-description" maxLength={8000} rows={6} value={draft.global?.jobDescription ?? ""}
          onChange={(event) => setGlobal({ jobDescription: event.target.value })} />
      </label>
      {([
        ["targetKeywords", "Important job-description keywords"],
        ["functionalCompetencies", "Confirmed domain or functional competencies"],
        ["technicalSkills", "Confirmed technical skills"],
      ] as const).map(([key, label]) => <label className="regional-field" htmlFor={key} key={key}>
        <span>{label} (one per line)</span><textarea id={key} rows={3} value={lines(draft.global?.[key])}
          onChange={(event) => setGlobal({ [key]: splitLines(event.target.value) })} />
      </label>)}
    </section>
    {gccEnabled && <section className="regional-intake-card" aria-labelledby="gcc-heading">
      <h2 id="gcc-heading">GCC verified details</h2>
      <p>Only details you confirm appear in the GCC resume. Leave unknown status or personal information blank.</p>
      <div className="regional-field-grid">
        <Text id="gcc-nationality" label="Nationality" value={draft.gcc?.nationality} onChange={(value) => setGcc({ nationality: value })} />
        <Text id="gcc-visa" label="Verified visa or work status" value={draft.gcc?.visaWorkStatus} onChange={(value) => setGcc({ visaWorkStatus: value })} />
        <Text id="gcc-notice" label="Verified notice period" value={draft.gcc?.noticePeriod} onChange={(value) => setGcc({ noticePeriod: value })} />
        <Text id="gcc-driving" label="Driving licence details" value={draft.gcc?.drivingLicence} onChange={(value) => setGcc({ drivingLicence: value })} />
        <Text id="gcc-personal" label="Optional personal information" value={draft.gcc?.maritalStatus} onChange={(value) => setGcc({ maritalStatus: value })} />
      </div>
      <label className="regional-checkbox"><input checked={draft.gcc?.photoConsent === true} type="checkbox"
        onChange={(event) => setGcc({ photoConsent: event.target.checked })} />
        I consent to use of my uploaded photograph in the GCC resume. I can revoke this here.</label>
    </section>}
    {euEnabled && <section className="regional-intake-card" aria-labelledby="eu-heading">
      <h2 id="eu-heading">European language and qualification details</h2>
      <p>Enter only language levels and EQF classifications you can verify. A candidate-entered EQF level is shown with its source.</p>
      <div className="regional-field-grid">
        <Text id="mother-tongue" label="Mother tongue" value={draft.eu?.motherTongue} onChange={(value) => setEu({ motherTongue: value })} />
        <Text id="eu-rights" label="Verified EU / EEA work authorization" value={draft.eu?.workAuthorization} onChange={(value) => setEu({ workAuthorization: value })} />
      </div>
      <h3>CEFR self-assessments</h3>
      {(draft.eu?.cefr ?? []).map((row, index) => <fieldset className="regional-subcard" key={index}>
        <legend>Language {index + 1}</legend>
        <Text id={`cefr-${index}-language`} label="Language" value={row.language} onChange={(value) => setCefr(index, { language: value })} />
        <div className="regional-field-grid">{axes.map(({ key, label }) =>
          <label className="regional-field" htmlFor={`cefr-${index}-${key}`} key={key}><span>{label}</span>
            <select id={`cefr-${index}-${key}`} value={row[key]} onChange={(event) => setCefr(index, { [key]: event.target.value })}>
              {levels.map((level) => <option key={level} value={level}>{level}</option>)}
            </select></label>)}</div>
        <button type="button" onClick={() => setEu({ cefr: draft.eu?.cefr?.filter((_, position) => position !== index) })}>Remove language</button>
      </fieldset>)}
      <button disabled={(draft.eu?.cefr?.length ?? 0) >= 12} type="button" onClick={addCefr}>Add language assessment</button>
      {education.length > 0 && <><h3>Verified EQF classifications</h3>
        {education.map((item) => {
          const existing = draft.eu?.eqf?.find((row) => row.educationId === item.id);
          const update = (level: number | undefined, verificationBasis: string) => setEu({ eqf: [
            ...(draft.eu?.eqf ?? []).filter((row) => row.educationId !== item.id),
            ...(level ? [{ educationId: item.id, level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, verificationBasis }] : []),
          ] });
          return <div className="regional-subcard" key={item.id}><h4>{item.qualification} — {item.institutionName}</h4>
            <div className="regional-field-grid"><label className="regional-field" htmlFor={`eqf-${item.id}`}><span>EQF level</span>
              <select id={`eqf-${item.id}`} value={existing?.level ?? ""} onChange={(event) => update(Number(event.target.value) || undefined, existing?.verificationBasis ?? "")}>
                <option value="">Not verified</option>{Array.from({ length: 8 }, (_, index) => index + 1).map((level) =>
                  <option key={level} value={level}>{level}</option>)}</select></label>
              {existing && <Text id={`eqf-source-${item.id}`} label="Verification source" value={existing.verificationBasis}
                onChange={(value) => update(existing.level, value)} max={300} />}</div>
          </div>;
        })}</>}
    </section>}
    <button className="type-button dashboard-primary-link" disabled={pending} type="submit">
      {pending ? "Saving…" : "Confirm verified regional details"}
    </button>
  </form>;
}
