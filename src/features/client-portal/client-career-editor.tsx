"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert, SelectField, TextareaField, TextInput } from "@/components/ui";

import { CareerDatePicker } from "./career-date-picker";
import { ADDITIONAL_ITEM_FIELDS, CAREER_FIELDS,
  type CareerDraft, type CareerField, type CareerRow, type CareerSection } from "./career-profile-model";
import { saveCareerProfileAction, type CareerActionState } from "./save-career-profile-action";
import { normalizeSkillName } from "./skill-name";

const initialState: CareerActionState = { status: "idle", message: "" };
const PROFICIENCIES = ["basic", "conversational", "professional-working", "fluent", "native-or-bilingual"];
type EditorSection = "summary" | CareerSection | "additional";
const NAV: { id: EditorSection; label: string }[] = [
  { id: "summary", label: "Summary" }, { id: "workExperience", label: "Work Experience" },
  { id: "skills", label: "Skills" }, { id: "education", label: "Education" },
  { id: "certifications", label: "Certifications" }, { id: "projects", label: "Projects" },
  { id: "languages", label: "Languages" }, { id: "additional", label: "Additional Information" },
];
const REPEATING: CareerSection[] = ["workExperience", "education", "certifications", "projects", "languages"];

function newRow(fields: CareerField[]): CareerRow {
  return { key: `new-${crypto.randomUUID()}`, ...Object.fromEntries(fields.map((field) =>
    [field.name, field.kind === "checkbox" ? false : ""])) };
}

function titleFor(section: CareerSection, row: CareerRow, index: number): string {
  const name = section === "workExperience" ? row.jobTitle : section === "education" ? row.qualification
    : section === "certifications" || section === "projects" || section === "languages" ? row.name : "";
  return String(name || `${CAREER_FIELDS[section].title} ${index + 1}`);
}

function CareerFields({ row, fields, prefix, disabled, onChange }: {
  row: CareerRow; fields: CareerField[]; prefix: string; disabled: boolean;
  onChange: (name: string, value: string | boolean) => void;
}) {
  return <div className="client-career-field-grid">{fields.flatMap((field) => {
    if (field.name === "endDate" && (row.currentRole || row.currentStudy || row.ongoing)) return [];
    if (field.name === "endYear" && row.currentStudy) return [];
    if (field.name === "completionYear" && row.currentStudy) return [];
    if (field.name === "expiresExactOn" && row.validityStatus !== "until-date") return [];
    if ((field.name === "expiresOn" || field.name === "expiryYear") && row.validityStatus) return [];
    const id = `${prefix}-${field.name}`;
    const value = row[field.name];
    if (field.kind === "checkbox") return [<label className="type-body client-career-checkbox" htmlFor={id} key={field.name}>
      <input checked={value === true} disabled={disabled} id={id}
        onChange={(event) => onChange(field.name, event.target.checked)} type="checkbox" />{field.label}
    </label>];
    if (field.kind === "month" || field.kind === "year" || field.kind === "day") return [<CareerDatePicker
      disabled={disabled} id={id} key={field.name} label={field.label} precision={field.kind}
      value={String(value ?? "")} onChange={(next) => onChange(field.name, next)} />];
    if (field.kind === "select" || field.kind === "proficiency") return [<SelectField id={id} key={field.name}
      label={field.label} disabled={disabled} onChange={(event) => onChange(field.name, event.target.value)}
      value={String(value ?? "")}>
      <option value="">Not specified</option>
      {(field.kind === "proficiency" ? PROFICIENCIES.map((option) => ({ value: option, label: option.replaceAll("-", " ") }))
        : field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </SelectField>];
    if (field.kind === "textarea" || field.kind === "lines") return [<TextareaField id={id} key={field.name}
      label={field.label} disabled={disabled} maxLength={field.max} rows={field.kind === "lines" ? 3 : 4}
      onChange={(event) => onChange(field.name, event.target.value)} value={String(value ?? "")} />];
    return [<TextInput id={id} key={field.name} label={field.label} disabled={disabled}
      maxLength={field.max} onChange={(event) => onChange(field.name, event.target.value)}
      type={field.kind === "url" ? "url" : "text"} value={String(value ?? "")} />];
  })}</div>;
}

export function ClientCareerEditor({ initial, revision, skillLibrary }: {
  initial: CareerDraft; revision: number; skillLibrary: string[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CareerDraft>(initial);
  const [section, setSection] = useState<EditorSection>("summary");
  const [selected, setSelected] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [state, action, isPending] = useActionState(saveCareerProfileAction, initialState);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state.status, state.savedAt]);

  function chooseSection(next: EditorSection) {
    setSection(next);
    setSelected(next === "additional" ? draft.additionalSections[0]?.key ?? null
      : REPEATING.includes(next as CareerSection) ? draft[next as CareerSection][0]?.key ?? null : null);
    setLocalMessage("");
  }
  function updateRow(target: CareerSection, key: string, name: string, value: string | boolean) {
    setDraft((current) => ({ ...current, [target]: current[target].map((row) => {
      if (row.key !== key) return row;
      const next = { ...row, [name]: value };
      if ((name === "currentRole" || name === "currentStudy" || name === "ongoing") && value === true) {
        next.endDate = "";
        if (name === "currentStudy") { next.endYear = ""; next.completionYear = ""; }
      }
      if (name === "validityStatus" && value !== "until-date") {
        next.expiresExactOn = "";
        if (value === "no-expiry" || value === "unknown") { next.expiresOn = ""; next.expiryYear = ""; }
      }
      if (name === "issuedExactOn" && value) { next.issuedOn = ""; next.issueYear = ""; }
      if (name === "expiresExactOn" && value) { next.expiresOn = ""; next.expiryYear = ""; }
      return next;
    }) }));
  }
  function addRow(target: CareerSection) {
    const row = newRow(CAREER_FIELDS[target].fields);
    setDraft((current) => ({ ...current, [target]: [...current[target], row] }));
    setSection(target); setSelected(row.key); setLocalMessage("New entry added. Save to keep it.");
  }
  function removeRow(target: CareerSection, key: string) {
    const next = draft[target].filter((row) => row.key !== key);
    setDraft((current) => ({ ...current, [target]: next }));
    if (selected === key) setSelected(next[0]?.key ?? null);
    setLocalMessage("Entry removed from this draft. Save to confirm.");
  }
  function moveRow(target: CareerSection, key: string, direction: -1 | 1) {
    setDraft((current) => { const rows = [...current[target]];
      const index = rows.findIndex((row) => row.key === key);
      if (index < 0 || index + direction < 0 || index + direction >= rows.length) return current;
      [rows[index], rows[index + direction]] = [rows[index + direction], rows[index]];
      return { ...current, [target]: rows };
    });
  }
  function addSkill(name: string) {
    const normalized = normalizeSkillName(name);
    if (!normalized.name || !normalized.key) { setLocalMessage("Enter a skill name before adding it."); return; }
    if (draft.skills.some((item) => normalizeSkillName(String(item.name)).key === normalized.key)) {
      setLocalMessage("That skill is already selected."); return;
    }
    setDraft((current) => ({ ...current, skills: [...current.skills,
      { key: `new-${crypto.randomUUID()}`, name: normalized.name, category: "" }] }));
    setSkillSearch(""); setCustomSkill(""); setLocalMessage(`${normalized.name} added. Save to keep it.`);
  }
  const activeRows = REPEATING.includes(section as CareerSection) ? draft[section as CareerSection] : [];
  const activeRow = activeRows.find((row) => row.key === selected) ?? activeRows[0];
  const activeAdditional = draft.additionalSections.find((item) => item.key === selected) ?? draft.additionalSections[0];
  const visibleSkills = skillLibrary.filter((name) => name.toLocaleLowerCase().includes(skillSearch.toLocaleLowerCase()) &&
    !draft.skills.some((item) => normalizeSkillName(String(item.name)).key === normalizeSkillName(name).key)).slice(0, 12);

  return <form action={action} aria-busy={isPending} className="career-v8-editor">
    <input name="revision" type="hidden" value={revision} />
    <input name="careerData" type="hidden" value={JSON.stringify(draft)} />
    <aside aria-label="Career sections" className="career-v8-sidebar">
      <p className="career-v8-sidebar-title">Career profile</p>
      <nav aria-label="Career editor sections" className="career-v8-section-list">
        {NAV.map((item) => {
          const rows = item.id === "summary" ? [] : item.id === "additional" ? draft.additionalSections : draft[item.id];
          const count = item.id === "summary" ? Number(Boolean(draft.professionalSummary.trim())) : rows.length;
          const nested = REPEATING.includes(item.id as CareerSection) || item.id === "additional";
          return <div className="career-v8-nav-group" key={item.id}>
            <button aria-current={section === item.id ? "page" : undefined} className="career-v8-section-button"
              onClick={() => chooseSection(item.id)} type="button"><span>{item.label}</span><span>{count}</span></button>
            {nested && section === item.id && rows.length > 0 && <div className="career-v8-children">{rows.map((row, index) =>
              <button aria-current={(selected ?? rows[0]?.key) === row.key ? "true" : undefined}
                className="career-v8-child-button" key={row.key} onClick={() => setSelected(row.key)} type="button">
                {item.id === "additional" ? String((row as { title: string }).title || `Section ${index + 1}`)
                  : titleFor(item.id as CareerSection, row as CareerRow, index)}
              </button>)}</div>}
          </div>;
        })}
      </nav>
      <p className="type-supporting text-text-muted career-v8-sidebar-note">Only career facts are editable. Zevantaa manages contact details and package assignment.</p>
    </aside>

    <div className="career-v8-workspace">
      <header className="career-v8-work-head">
        <div><p className="type-label dashboard-kicker">Career profile · {section === "summary" ? "Summary" : section === "additional" ? "Additional information" : CAREER_FIELDS[section].title}</p>
          <h2 className="type-heading-2">{section === "summary" ? "Professional Summary" : section === "additional" ? "Additional Information" : CAREER_FIELDS[section].title}</h2>
          <p className="type-supporting text-text-muted">Keep every statement factual. Optional details can remain blank.</p></div>
        <button className="type-button dashboard-text-link" onClick={() => router.refresh()} type="button">Load latest</button>
      </header>
      <div className="career-v8-scroll">
        {state.message && <InlineAlert variant={state.status === "success" ? "success" : state.status === "stale" ? "warning" : "error"}>{state.message}</InlineAlert>}
        {localMessage && <p aria-live="polite" className="type-supporting">{localMessage}</p>}
        {section === "summary" && <div className="career-v8-entry-card"><h3 className="type-heading-3">Professional summary</h3>
          <TextareaField id="career-summary" label="Professional summary (optional)" disabled={isPending} maxLength={10000} rows={7}
            onChange={(event) => setDraft((current) => ({ ...current, professionalSummary: event.target.value }))}
            value={draft.professionalSummary} /></div>}
        {section === "skills" && <div className="career-v8-entry-card">
          <h3 className="type-heading-3">Selected skills <span className="type-supporting">({draft.skills.length})</span></h3>
          <div className="career-v8-skill-chips">{draft.skills.map((skill) => <span className="career-v8-skill-chip" key={skill.key}>
            {String(skill.name)}<button aria-label={`Remove ${String(skill.name)}`} disabled={isPending}
              onClick={() => removeRow("skills", skill.key)} type="button">×</button></span>)}</div>
          <TextInput id="career-skill-search" label="Search skill library" onChange={(event) => setSkillSearch(event.target.value)} value={skillSearch} />
          {skillSearch && <div aria-label="Matching skills" className="career-v8-skill-results">{visibleSkills.map((name) =>
            <button key={name} onClick={() => addSkill(name)} type="button">{name}<span aria-hidden="true">＋</span></button>)}
            {!visibleSkills.length && <p className="type-supporting text-text-muted">No matching skill. Add a custom skill below.</p>}</div>}
          <div className="career-v8-custom-skill"><TextInput id="career-custom-skill" label="Add custom skill" maxLength={200}
            onChange={(event) => setCustomSkill(event.target.value)} value={customSkill} />
            <button className="type-button dashboard-text-link" disabled={isPending || !customSkill.trim()}
              onClick={() => addSkill(customSkill)} type="button">Add skill</button></div>
        </div>}
        {REPEATING.includes(section as CareerSection) && <div className="career-v8-entry-area">
          {activeRow ? <div className="career-v8-entry-card" key={activeRow.key}>
            <div className="career-v8-entry-head"><div><h3 className="type-heading-3">{titleFor(section as CareerSection, activeRow, activeRows.indexOf(activeRow))}</h3>
              <p className="type-supporting text-text-muted">Entry {activeRows.indexOf(activeRow) + 1} of {activeRows.length}</p></div>
              <button className="type-button dashboard-text-link" disabled={isPending}
                onClick={() => removeRow(section as CareerSection, activeRow.key)} type="button">Delete entry</button></div>
            <CareerFields row={activeRow} fields={CAREER_FIELDS[section as CareerSection].fields} prefix={`${section}-${activeRow.key}`}
              disabled={isPending} onChange={(name, value) => updateRow(section as CareerSection, activeRow.key, name, value)} />
            <div className="client-career-row-actions"><button className="type-button dashboard-text-link" disabled={isPending || activeRows.indexOf(activeRow) === 0}
              onClick={() => moveRow(section as CareerSection, activeRow.key, -1)} type="button">Move up</button>
              <button className="type-button dashboard-text-link" disabled={isPending || activeRows.indexOf(activeRow) === activeRows.length - 1}
                onClick={() => moveRow(section as CareerSection, activeRow.key, 1)} type="button">Move down</button></div>
          </div> : <p className="type-supporting text-text-muted">No entries yet. Add one to begin.</p>}
          <button className="type-button dashboard-primary-link" disabled={isPending || activeRows.length >= 50}
            onClick={() => addRow(section as CareerSection)} type="button">Add {CAREER_FIELDS[section as CareerSection].title.toLowerCase()} entry</button>
        </div>}
        {section === "additional" && <div className="career-v8-entry-area">
          {activeAdditional && <div className="career-v8-entry-card" key={activeAdditional.key}>
            <TextInput id={`additional-title-${activeAdditional.key}`} label="Section title" maxLength={200}
              disabled={isPending} value={activeAdditional.title} onChange={(event) => setDraft((current) => ({ ...current,
                additionalSections: current.additionalSections.map((entry) => entry.key === activeAdditional.key
                  ? { ...entry, title: event.target.value } : entry) }))} />
            {activeAdditional.items.map((item, index) => <div className="client-career-nested-entry" key={item.key}>
              <h3 className="type-heading-4">Item {index + 1}</h3>
              <CareerFields row={item} fields={ADDITIONAL_ITEM_FIELDS} prefix={`additional-${activeAdditional.key}-${item.key}`}
                disabled={isPending} onChange={(name, value) => setDraft((current) => ({ ...current,
                  additionalSections: current.additionalSections.map((parent) => parent.key === activeAdditional.key
                    ? { ...parent, items: parent.items.map((entry) => entry.key === item.key ? { ...entry, [name]: value } : entry) } : parent) }))} />
              <button className="type-button dashboard-text-link" disabled={isPending} onClick={() => setDraft((current) => ({ ...current,
                additionalSections: current.additionalSections.map((parent) => parent.key === activeAdditional.key
                  ? { ...parent, items: parent.items.filter((entry) => entry.key !== item.key) } : parent) }))} type="button">Remove item</button>
            </div>)}
            <div className="client-career-row-actions"><button className="type-button dashboard-text-link" disabled={isPending || activeAdditional.items.length >= 50}
              onClick={() => setDraft((current) => ({ ...current, additionalSections: current.additionalSections.map((parent) =>
                parent.key === activeAdditional.key ? { ...parent, items: [...parent.items, newRow(ADDITIONAL_ITEM_FIELDS)] } : parent) }))}
              type="button">Add item</button>
              <button className="type-button dashboard-text-link" disabled={isPending} onClick={() => { const next = draft.additionalSections.filter((item) => item.key !== activeAdditional.key);
                setDraft((current) => ({ ...current, additionalSections: next })); setSelected(next[0]?.key ?? null); }} type="button">Remove section</button></div>
          </div>}
          <button className="type-button dashboard-primary-link" disabled={isPending || draft.additionalSections.length >= 50}
            onClick={() => { const entry = { key: `new-${crypto.randomUUID()}`, title: "", items: [] };
              setDraft((current) => ({ ...current, additionalSections: [...current.additionalSections, entry] })); setSelected(entry.key); }} type="button">Add section</button>
        </div>}
      </div>
      <footer className="career-v8-save-bar"><span aria-live="polite" className="type-supporting">{isPending ? "Saving..." : dirty ? "Unsaved changes" : state.status === "success" ? "Saved" : "No unsaved changes"}</span>
        <div><button className="type-button dashboard-text-link" disabled={isPending} onClick={() => router.refresh()} type="button">Load latest</button>
          <button className="type-button auth-submit" disabled={isPending || state.status === "stale"} type="submit">{isPending ? "Saving..." : "Save changes"}</button></div></footer>
    </div>
  </form>;
}
