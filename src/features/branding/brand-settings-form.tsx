"use client";

import Image from "next/image";
import { useActionState } from "react";

import { InlineAlert, SelectField } from "@/components/ui";
import { BRAND_ACCENTS, BRAND_FONT_FAMILY, type BrandSettings } from "./brand-settings-config";
import { saveBrandSettingsAction, type BrandActionState } from "./save-brand-settings-action";

const idle: BrandActionState = { status: "idle", message: "" };
const UI_FONTS = ["inter", "arial", "segoe-ui", "verdana"] as const;
const HEADING_FONTS = [...UI_FONTS, "georgia"] as const;

export function BrandSettingsForm({ settings }: { settings: BrandSettings }) {
  const [state, action, pending] = useActionState(saveBrandSettingsAction, idle);
  return <form action={action} className="brand-v8-form">
    {state.message && <InlineAlert variant={state.status === "success" ? "success" : "error"}>{state.message}</InlineAlert>}
    <div className="brand-v8-grid">
      <div className="brand-v8-settings">
        <div className="brand-v8-setting"><div><strong>Primary logo</strong><p>Used in login and portal navigation.</p></div>
          <label>Upload PNG or WebP, up to 2 MB<input accept="image/png,image/webp" disabled={pending} name="logo" type="file" /></label></div>
        <div className="brand-v8-setting"><div><strong>Compact mark / favicon</strong><p>Used as the browser mark when configured.</p></div>
          <label>Upload PNG or WebP, up to 2 MB<input accept="image/png,image/webp" disabled={pending} name="mark" type="file" /></label></div>
        <div className="brand-v8-setting"><div><strong>Application typography</strong><p>Body and control text.</p></div>
          <SelectField id="brand-ui-font" label="UI font" name="uiFont" defaultValue={settings.uiFont} disabled={pending}>
            {UI_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</SelectField></div>
        <div className="brand-v8-setting"><div><strong>Heading typography</strong><p>Headings may use a separate approved family.</p></div>
          <SelectField id="brand-heading-font" label="Heading font" name="headingFont" defaultValue={settings.headingFont} disabled={pending}>
            {HEADING_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</SelectField></div>
        <fieldset className="brand-v8-setting"><legend>Accent color</legend><div className="brand-v8-swatches">
          {BRAND_ACCENTS.map((color) => <label key={color}><input defaultChecked={settings.accentColor === color}
            disabled={pending} name="accentColor" type="radio" value={color} /><span style={{ backgroundColor: color }} />{color}</label>)}
        </div></fieldset>
      </div>
      <aside className="brand-v8-preview"><div className="brand-v8-preview-head"><Image alt="Current Zevantaa logo" height={68}
        src={settings.logoObjectKey ? "/branding/current/logo" : "/branding/zevantaa-logo-reversed.svg"} unoptimized width={190} /></div>
        <div className="brand-v8-preview-body"><p className="type-label">Preview</p><h2>Career documents, presented clearly.</h2>
          <p>Built-in approved Zevantaa assets remain the fallback if custom settings are unavailable.</p>
          <p>Current fonts: {BRAND_FONT_FAMILY[settings.uiFont]} · {BRAND_FONT_FAMILY[settings.headingFont]}</p></div></aside>
    </div>
    <div className="brand-v8-actions"><button className="type-button dashboard-primary-link" disabled={pending} type="submit">{pending ? "Saving..." : "Save appearance"}</button></div>
  </form>;
}
