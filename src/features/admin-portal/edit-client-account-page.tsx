import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { packageAllowsOutput } from "@/features/document-generation/package-routing";
import { DocumentAtsComparisonCard } from "@/features/document-generation/document-ats-comparison-card";
import { getAdminDocumentAtsComparison } from "@/features/document-generation/document-ats-comparison-service";

import { getProvisionedClient } from "./client-account-service";
import { EditClientAccountForm } from "./edit-client-account-form";
import { ClientAccessDetails } from "./client-access-details";
import { buildClientWelcomeMessages } from "./welcome-message";
import { ArchiveClientControl } from "./client-lifecycle-controls";
import { getClientDeletionImpact } from "./client-lifecycle-service";

export async function EditClientAccountPage({ userId }: { userId: string }) {
  const client = await getProvisionedClient(userId);

  if (!client) {
    notFound();
  }
  const [documentComparison, deletionImpact] = await Promise.all([
    getAdminDocumentAtsComparison(client.candidateProfileId),
    getClientDeletionImpact(client.candidateProfileId),
  ]);
  const welcome = buildClientWelcomeMessages({
    fullName: client.fullName, mobileNumber: client.mobileNumber,
    whatsappNumber: client.whatsappNumber, email: client.email,
    packageName: client.packageName, portalUrl: client.clientPortalUrl,
  });

  return (
    <div className="dashboard-page">
      <div className="layout-container-readable layout-stack">
        <PageHeader
          actions={<StatusBadge
              variant={client.accountStatus === "active" ? "success" : "neutral"}
            >
              {client.accountStatus === "active" ? "Active" : "Disabled"}
            </StatusBadge>}
          description={`${client.fullName} · Current package: ${client.packageName}`}
          eyebrow="Admin portal"
          title="Edit client account"
        />

        <SectionCard
          description="Account changes preserve the existing Auth user and candidate-profile link."
          title="Client profile, access and package"
        >
          <EditClientAccountForm client={client} />
        </SectionCard>

        <SectionCard
          className="client-access-details-section"
          description="Prepared communication and secure access controls. Delivery state is shown separately from message preparation."
          title="Client Access Details"
        >
          <div id="client-access-details"><ClientAccessDetails client={client} completeMessage={welcome.complete} whatsappMessage={welcome.whatsapp} /></div>
        </SectionCard>

        <DocumentAtsComparisonCard comparison={documentComparison} />

        {deletionImpact && <ArchiveClientControl client={deletionImpact} />}

        <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/resume-review`}>
          Review current source resume
        </Link>

        <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/documents`}>
          View stored documents and generators
        </Link>

        {packageAllowsOutput(client.packageCode, "global-ats-resume") && <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/global-ats`}>
          Review Global ATS resume readiness
        </Link>}

        {packageAllowsOutput(client.packageCode, "domestic-resume-1") && <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/domestic-resumes`}>
          Review and download domestic resumes
        </Link>}

        {packageAllowsOutput(client.packageCode, "gcc-resume") && <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/gcc-resume`}>
          Review and download GCC resume
        </Link>}

        {packageAllowsOutput(client.packageCode, "europass-eu-resume") && <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/european-resume`}>
          Review and download European resume
        </Link>}

        {packageAllowsOutput(client.packageCode, "general-corporate-cover-letter") && <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/cover-letters`}>
          Review and download cover letters
        </Link>}

        <Link className="type-label admin-table-link" href="/admin/clients">
          Return to client accounts
        </Link>
      </div>
    </div>
  );
}
