import Link from "next/link";

import { InlineAlert, SectionCard } from "@/components/ui";

import { ClientAccountForm } from "./client-account-form";
import { getPackageOptions, listEligibleCandidateProfiles } from "./client-account-service";

export async function CreateClientAccountPage() {
  const [candidates, packages] = await Promise.all([listEligibleCandidateProfiles(), getPackageOptions()]);

  return (
    <div className="dashboard-page">
      <div className="layout-container-readable layout-stack">
        <header className="layout-stack client-account-header">
          <div>
            <p className="type-label text-text-muted">Admin portal</p>
            <h1 className="type-heading-1 text-text">Create client account</h1>
          </div>
          <p className="type-body text-text-muted">
            Create a new candidate or select an existing unlinked profile, review
            core details, assign a package, and provision email/password access.
          </p>
        </header>

        <SectionCard
          description="Credentials are created in Supabase Auth through a trusted server action."
          title="Account details"
        >
          {candidates.length === 0 ? <InlineAlert variant="information">No existing candidate profiles are available. Create a new profile below.</InlineAlert> : null}
          <ClientAccountForm candidates={candidates} packages={packages} />
        </SectionCard>

        <Link
          className="type-label text-text underline decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href="/admin"
        >
          Return to admin portal
        </Link>
      </div>
    </div>
  );
}
