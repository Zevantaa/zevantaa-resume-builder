"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert, SectionCard, SelectField, TextareaField, TextInput } from "@/components/ui";

import { ADDITIONAL_ITEM_FIELDS, CAREER_FIELDS, CAREER_SECTION_NAMES,
  type CareerDraft, type CareerField, type CareerRow, type CareerSection } from "./career-profile-model";
import { saveCareerProfileAction, type CareerActionState } from "./save-career-profile-action";

const initialState: CareerActionState = { status: "idle", message: "" };
const PROFICIENCIES = ["basic", "conversational", "professional-working", "fluent", "native-or-bilingual"];

function newRow(fields: CareerField[]): CareerRow {
  return { key: `new-${crypto.randomUUID()}`, ...Object.fromEntries(fields.map((field) =>
    [field.name, field.kind === "checkbox" ? false : ""])) };
}

function CareerFields({ row, fields, prefix, disabled, onChange }: {
  row: CareerRow; fields: CareerField[]; prefix: string; disabled: boolean;
  onChange: (name: string, value: string | boolean) => void;
}) {
  return <div className="client-career-field-grid">{fields.map((field) => {
    const id = `${prefix}-${field.name}`;
    const value = row[field.name];
    if (field.kind === "checkbox") return <label className="type-body client-career-checkbox" htmlFor={id} key={field.name}>
      <input checked={value === true} disabled={disabled} id={id} onChange={(event) => onChange(field.name, event.target.checked)} type="checkbox" />
      {field.label}
    </label>;
    if (field.kind === "proficiency") return <SelectField id={id} key={field.name} label={field.label}
      disabled={disabled} onChange={(event) => onChange(field.name, event.target.value)} value={String(value ?? "")}>
      <option value="">Not specified</option>
      {PROFICIENCIES.map((option) => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}
    </SelectField>;
    if (field.kind === "textarea" || field.kind === "lines") return <TextareaField id={id} key={field.name}
      label={field.label} disabled={disabled} maxLength={field.max} rows={field.kind === "lines" ? 3 : 4}
      onChange={(event) => onChange(field.name, event.target.value)} value={String(value ?? "")} />;
    return <TextInput id={id} key={field.name} label={field.label} disabled={disabled}
      maxLength={field.max} onChange={(event) => onChange(field.name, event.target.value)}
      type={field.kind === "month" ? "month" : field.kind === "url" ? "url" : "text"}
      value={String(value ?? "")} />;
  })}</div>;
}

function RowControls({ index, count, disabled, onMove, onRemove }: {
  index: number; count: number; disabled: boolean; onMove: (direction: -1 | 1) => void; onRemove: () => void;
}) {
  return <div className="client-career-row-actions">
    <button className="type-button dashboard-text-link" disabled={disabled || index === 0} onClick={() => onMove(-1)} type="button">Move up</button>
    <button className="type-button dashboard-text-link" disabled={disabled || index === count - 1} onClick={() => onMove(1)} type="button">Move down</button>
    <button className="type-button dashboard-text-link" disabled={disabled} onClick={onRemove} type="button">Remove</button>
  </div>;
}

export function ClientCareerEditor({ initial, revision }: { initial: CareerDraft; revision: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<CareerDraft>(initial);
  const [state, action, isPending] = useActionState(saveCareerProfileAction, initialState);
  useEffect(() => { if (state.status === "success") router.refresh(); }, [router, state.status, state.savedAt]);

  function updateRow(section: CareerSection, index: number, name: string, value: string | boolean) {
    setDraft((current) => ({ ...current, [section]: current[section].map((row, at) =>
      at === index ? { ...row, [name]: value } : row) }));
  }
  function moveRow(section: CareerSection, index: number, direction: -1 | 1) {
    setDraft((current) => {
      const rows = [...current[section]];
      [rows[index], rows[index + direction]] = [rows[index + direction], rows[index]];
      return { ...current, [section]: rows };
    });
  }
  function updateAdditionalItem(sectionIndex: number, itemIndex: number, name: string, value: string | boolean) {
    setDraft((current) => ({ ...current, additionalSections: current.additionalSections.map((section, at) =>
      at === sectionIndex ? { ...section, items: section.items.map((item, itemAt) =>
        itemAt === itemIndex ? { ...item, [name]: value } : item) } : section) }));
  }

  return <form action={action} aria-busy={isPending} className="layout-stack client-career-editor">
    <input name="revision" type="hidden" value={revision} />
    <input name="careerData" type="hidden" value={JSON.stringify(draft)} />
    {state.message && <InlineAlert variant={state.status === "success" ? "success" : state.status === "stale" ? "warning" : "error"}>{state.message}</InlineAlert>}
    {state.status === "stale" && <button className="type-button dashboard-text-link" onClick={() => router.refresh()} type="button">Load latest profile</button>}
    <p className="type-supporting text-text-muted">New career facts are saved as client-authored canonical data. Replacing an uploaded resume is a separate administrator-review workflow.</p>
    <SectionCard title="Professional Summary" description="Use only your own factual career summary; no claims are generated here.">
      <TextareaField id="career-summary" label="Professional summary" disabled={isPending} maxLength={10000} rows={6}
        onChange={(event) => setDraft((current) => ({ ...current, professionalSummary: event.target.value }))}
        value={draft.professionalSummary} />
    </SectionCard>
    {CAREER_SECTION_NAMES.map((section) => <SectionCard key={section} title={CAREER_FIELDS[section].title}
      description="Add, edit, remove, or reorder explicitly supplied entries.">
      <div className="layout-stack">{draft[section].map((row, index) => <div className="client-career-entry" key={row.key}>
        <p className="type-label">Entry {index + 1}</p>
        <CareerFields row={row} fields={CAREER_FIELDS[section].fields} prefix={`${section}-${row.key}`}
          disabled={isPending} onChange={(name, value) => updateRow(section, index, name, value)} />
        <RowControls index={index} count={draft[section].length} disabled={isPending}
          onMove={(direction) => moveRow(section, index, direction)}
          onRemove={() => setDraft((current) => ({ ...current, [section]: current[section].filter((_, at) => at !== index) }))} />
      </div>)}
      <button className="type-button dashboard-text-link" disabled={isPending || draft[section].length >= 50}
        onClick={() => setDraft((current) => ({ ...current, [section]: [...current[section], newRow(CAREER_FIELDS[section].fields)] }))}
        type="button">Add {CAREER_FIELDS[section].title.toLowerCase()} entry</button></div>
    </SectionCard>)}
    <SectionCard title="Additional Information" description="Optional career sections that do not fit the standard headings.">
      <div className="layout-stack">{draft.additionalSections.map((section, sectionIndex) => <div className="client-career-entry" key={section.key}>
        <TextInput id={`additional-title-${section.key}`} label="Section title" disabled={isPending}
          maxLength={200} onChange={(event) => setDraft((current) => ({ ...current,
            additionalSections: current.additionalSections.map((item, at) => at === sectionIndex
              ? { ...item, title: event.target.value } : item) }))} value={section.title} />
        {section.items.map((item, itemIndex) => <div className="client-career-nested-entry" key={item.key}>
          <CareerFields row={item} fields={ADDITIONAL_ITEM_FIELDS} prefix={`additional-${section.key}-${item.key}`}
            disabled={isPending} onChange={(name, value) => updateAdditionalItem(sectionIndex, itemIndex, name, value)} />
          <RowControls index={itemIndex} count={section.items.length} disabled={isPending}
            onMove={(direction) => setDraft((current) => ({ ...current,
              additionalSections: current.additionalSections.map((parent, at) => {
                if (at !== sectionIndex) return parent;
                const items = [...parent.items];
                [items[itemIndex], items[itemIndex + direction]] = [items[itemIndex + direction], items[itemIndex]];
                return { ...parent, items };
              }) }))}
            onRemove={() => setDraft((current) => ({ ...current,
              additionalSections: current.additionalSections.map((parent, at) => at === sectionIndex
                ? { ...parent, items: parent.items.filter((_, atItem) => atItem !== itemIndex) } : parent) }))} />
        </div>)}
        <div className="client-career-row-actions">
          <button className="type-button dashboard-text-link" disabled={isPending || section.items.length >= 50}
            onClick={() => setDraft((current) => ({ ...current,
              additionalSections: current.additionalSections.map((parent, at) => at === sectionIndex
                ? { ...parent, items: [...parent.items, newRow(ADDITIONAL_ITEM_FIELDS)] } : parent) }))}
            type="button">Add entry</button>
          <button className="type-button dashboard-text-link" disabled={isPending || sectionIndex === 0}
            onClick={() => setDraft((current) => { const sections = [...current.additionalSections];
              [sections[sectionIndex - 1], sections[sectionIndex]] = [sections[sectionIndex], sections[sectionIndex - 1]];
              return { ...current, additionalSections: sections }; })} type="button">Move section up</button>
          <button className="type-button dashboard-text-link" disabled={isPending || sectionIndex === draft.additionalSections.length - 1}
            onClick={() => setDraft((current) => { const sections = [...current.additionalSections];
              [sections[sectionIndex], sections[sectionIndex + 1]] = [sections[sectionIndex + 1], sections[sectionIndex]];
              return { ...current, additionalSections: sections }; })} type="button">Move section down</button>
          <button className="type-button dashboard-text-link" disabled={isPending}
            onClick={() => setDraft((current) => ({ ...current,
              additionalSections: current.additionalSections.filter((_, at) => at !== sectionIndex) }))}
            type="button">Remove section</button>
        </div>
      </div>)}
      <button className="type-button dashboard-text-link" disabled={isPending || draft.additionalSections.length >= 50}
        onClick={() => setDraft((current) => ({ ...current, additionalSections: [...current.additionalSections,
          { key: `new-${crypto.randomUUID()}`, title: "", items: [] }] }))} type="button">Add section</button></div>
    </SectionCard>
    <div className="client-contact-actions">
      <p className="type-supporting text-text-muted">Saving updates your canonical career profile. Earlier PDFs do not change; request a fresh PDF when needed.</p>
      <button className="type-button auth-submit" disabled={isPending || state.status === "stale"} type="submit">
        {isPending ? "Saving career updates…" : "Save career updates"}
      </button>
    </div>
  </form>;
}
