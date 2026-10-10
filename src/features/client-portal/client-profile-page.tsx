import Link from "next/link";

import { Card, InlineAlert } from "@/components/ui";
import { isGccPhotoAvailable } from "@/features/document-generation/package-routing";

import { ClientIntakeForm } from "./client-intake-form";
import { getClientIntakeFiles } from "./client-intake-service";
import { getClientContactProfile } from "./contact-profile-service";
import { getClientProfileDetails } from "./profile-details-service";

export async function ClientProfilePage() {
  const [profile, details, files] = await Promise.all([
    getClientContactProfile(),
    getClientProfileDetails(),
    getClientIntakeFiles(),
  ]);

  return (
    <div className="dashboard-page">
        <div className="dashboard-profile-content layout-stack">
          <div className="client-profile-intro">
            <p className="type-label dashboard-kicker">Profile & intake</p>
            <h1 className="type-heading-1 text-text">Your candidate profile</h1>
            <p className="type-body text-text-muted">
              Review your Zevantaa-managed details and upload your private source
              resume{details && isGccPhotoAvailable(details.selectedPackageCode) ? " or optional GCC photograph" : ""}.
            </p>
          </div>

          <Card className="client-contact-card">
            <div className="client-contact-card-heading">
              <h2 className="type-heading-3 text-text">
                Personal contact information
              </h2>
              <p className="type-supporting text-text-muted">
                These details are read-only in the client portal.
              </p>
            </div>
            {profile && details && files ? (
              <ClientIntakeForm profile={profile} details={details} files={files} />
            ) : (
              <InlineAlert variant="error">
                Your linked profile is unavailable. Please contact Zevantaa
                support.
              </InlineAlert>
            )}
          </Card>
          <section className="dashboard-profile-upcoming" aria-labelledby="career-profile-heading">
            <p className="type-label dashboard-kicker">Career updates</p>
            <h2 className="type-heading-3" id="career-profile-heading">Keep your career facts current</h2>
            <p className="type-body text-text-muted">You can update your structured summary, experience, education, skills and other career sections. Zevantaa-managed identity and package fields stay read-only.</p>
            <Link className="type-button dashboard-primary-link" href="/client/career-profile">Update Career Profile</Link>
          </section>
        </div>
    </div>
  );
}
