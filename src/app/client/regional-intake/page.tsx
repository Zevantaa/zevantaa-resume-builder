import Link from "next/link";

import { InlineAlert, PageHeader } from "@/components/ui";
import { ClientRegionalIntakeEditor } from "@/features/client-portal/client-regional-intake-editor";
import { getCurrentClientCareerProfile } from "@/features/client-portal/career-profile-service";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";

export const dynamic = "force-dynamic";

export default async function ClientRegionalIntakePage() {
  const snapshot = await getCurrentClientCareerProfile();
  return <div className="dashboard-page layout-container-readable layout-stack">
    <PageHeader eyebrow="Client portal" title="Regional targets and verified details"
      description="Confirm optional facts for your existing package outputs. Unknown facts may remain blank; no visa, qualification, or metric is inferred." />
    {snapshot ? <ClientRegionalIntakeEditor key={snapshot.revision} initial={snapshot.profile.regionalIntake}
      revision={snapshot.revision} education={snapshot.profile.education}
      gccEnabled={packageAllowsOutput(snapshot.profile.selectedPackage, "gcc-resume")}
      euEnabled={packageAllowsOutput(snapshot.profile.selectedPackage, "europass-eu-resume")} />
      : <InlineAlert variant="error">Your linked profile is unavailable. Contact Zevantaa support.</InlineAlert>}
    <Link className="type-button dashboard-text-link" href="/client/career-profile">Review career facts</Link>
  </div>;
}
