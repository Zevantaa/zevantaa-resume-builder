import { BrandSettingsForm } from "@/features/branding/brand-settings-form";
import { getBrandSettings } from "@/features/branding/brand-settings-service";

export const dynamic = "force-dynamic";

export default async function AdminAppearancePage() {
  const settings = await getBrandSettings();
  return <div className="dashboard-page dashboard-workspace-page brand-v8-page">
    <header className="dashboard-workspace-intro"><p className="type-label dashboard-kicker">Administration · Appearance</p>
      <h1 className="type-heading-1">Brand & typography settings</h1>
      <p className="type-body text-text-muted">Manage approved application appearance from one protected source.</p></header>
    <BrandSettingsForm settings={settings} />
  </div>;
}
