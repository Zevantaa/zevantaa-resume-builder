import { Card, InlineAlert } from "@/components/ui";

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
              Keep your contact and mobility details current, and provide your
              source resume. Your package remains managed by Zevantaa.
            </p>
          </div>

          <Card className="client-contact-card">
            <div className="client-contact-card-heading">
              <h2 className="type-heading-3 text-text">
                Personal contact information
              </h2>
              <p className="type-supporting text-text-muted">
                Review these details carefully before saving.
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
          <section className="dashboard-profile-upcoming" aria-labelledby="upcoming-intake-heading">
            <p className="type-label dashboard-kicker">Next intake sections</p>
            <h2 className="type-heading-3" id="upcoming-intake-heading">Your profile will grow here</h2>
            <p className="type-body text-text-muted">Experience, education and skills are not editable yet. Package changes remain with the administrator.</p>
          </section>
        </div>
    </div>
  );
}
