import Link from "next/link";

import { InlineAlert, PageHeader, SectionCard } from "@/components/ui";

import { ClientAccountForm } from "./client-account-form";
import { getPackageOptions, listEligibleCandidateProfiles } from "./client-account-service";

export async function CreateClientAccountPage() {
  const [candidates, packages] = await Promise.all([listEligibleCandidateProfiles(), getPackageOptions()]);

  return (
    <div className="dashboard-page">
      <div className="layout-container-readable layout-stack">
        <PageHeader
          description="Create a new candidate or select an existing unlinked profile, review core details, assign a package, and send secure password-setup access."
          eyebrow="Admin portal"
          title="Create client account"
        />

        <SectionCard
          description="A one-time invitation is sent through Supabase Auth by a trusted server action; no password is shown to the administrator."
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
