import { Card, InlineAlert } from "@/components/ui";

import { ContactProfileForm } from "./contact-profile-form";
import { getClientContactProfile } from "./contact-profile-service";

export async function ClientProfilePage() {
  const profile = await getClientContactProfile();

  return (
    <div className="dashboard-page">
        <div className="dashboard-profile-content layout-stack">
          <div className="client-profile-intro">
            <p className="type-label dashboard-kicker">Profile & intake</p>
            <h1 className="type-heading-1 text-text">Your candidate profile</h1>
            <p className="type-body text-text-muted">
              Keep the details Zevantaa uses to contact you and prepare your
              candidate profile up to date.
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
            {profile ? (
              <ContactProfileForm profile={profile} />
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
            <p className="type-body text-text-muted">Location and market preferences, experience and education, skills, and source resume uploads are not editable yet. The contact details above are the only active fields on this screen.</p>
          </section>
        </div>
    </div>
  );
}
