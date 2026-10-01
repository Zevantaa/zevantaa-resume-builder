import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionCard, StatusBadge } from "@/components/ui";

import { getProvisionedClient } from "./client-account-service";
import { EditClientAccountForm } from "./edit-client-account-form";

export async function EditClientAccountPage({ userId }: { userId: string }) {
  const client = await getProvisionedClient(userId);

  if (!client) {
    notFound();
  }

  return (
    <div className="dashboard-page">
      <div className="layout-container-readable layout-stack">
        <header className="layout-stack client-account-header">
          <div className="admin-edit-heading">
            <div>
              <p className="type-label text-text-muted">Admin portal</p>
              <h1 className="type-heading-1 text-text">Edit client account</h1>
            </div>
            <StatusBadge
              variant={client.accountStatus === "active" ? "success" : "neutral"}
            >
              {client.accountStatus === "active" ? "Active" : "Disabled"}
            </StatusBadge>
          </div>
          <p className="type-body text-text-muted">
            {client.fullName} · Current package: {client.packageName}
          </p>
        </header>

        <SectionCard
          description="Account changes preserve the existing Auth user and candidate-profile link."
          title="Client profile, access and package"
        >
          <EditClientAccountForm client={client} />
        </SectionCard>

        <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/resume-review`}>
          Review current source resume
        </Link>

        <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/global-ats`}>
          Review Global ATS resume readiness
        </Link>

        <Link className="type-label admin-table-link" href={`/admin/clients/${userId}/domestic-resumes`}>
          Review and download domestic resumes
        </Link>

        <Link className="type-label admin-table-link" href="/admin/clients">
          Return to client accounts
        </Link>
      </div>
    </div>
  );
}
