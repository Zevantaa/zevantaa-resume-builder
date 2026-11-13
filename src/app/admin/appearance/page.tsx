import { PageHeader } from "@/components/ui";
import { BrandSettingsForm } from "@/features/branding/brand-settings-form";
import { getBrandSettings } from "@/features/branding/brand-settings-service";

export const dynamic = "force-dynamic";

export default async function AdminAppearancePage() {
  const settings = await getBrandSettings();
  return <div className="dashboard-page dashboard-workspace-page brand-v8-page">
    <PageHeader
      description="Manage approved application appearance from one protected source."
      eyebrow="Administration · Appearance"
      title="Brand & typography settings"
    />
    <BrandSettingsForm settings={settings} />
  </div>;
}
