import Link from "next/link";

import { InlineAlert, SectionCard } from "@/components/ui";

import { ClientAccountForm } from "./client-account-form";
import { listEligibleCandidateProfiles } from "./client-account-service";

export async function CreateClientAccountPage() {
  const candidates = await listEligibleCandidateProfiles();

  return (
    <main className="layout-page bg-background">
      <div className="layout-container-readable layout-stack">
        <header className="layout-stack client-account-header">
          <div>
            <p className="type-label text-text-muted">Admin portal</p>
            <h1 className="type-heading-1 text-text">Create client account</h1>
          </div>
          <p className="type-body text-text-muted">
            Provision email/password access and link it to an existing candidate
            profile.
          </p>
        </header>

        <SectionCard
          description="Credentials are created in Supabase Auth through a trusted server action."
          title="Account details"
        >
          {candidates.length === 0 ? (
            <InlineAlert variant="warning">
              No active candidate profiles are available for account creation.
            </InlineAlert>
          ) : null}
          <ClientAccountForm candidates={candidates} />
        </SectionCard>

        <Link
          className="type-label text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href="/admin"
        >
          Return to admin portal
        </Link>
      </div>
    </main>
  );
}
