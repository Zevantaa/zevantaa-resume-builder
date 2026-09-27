import { Card, InlineAlert } from "@/components/ui";

import { ContactProfileForm } from "./contact-profile-form";
import { getClientContactProfile } from "./contact-profile-service";
import { ProfileDetailsForm } from "./profile-details-form";
import { getClientProfileDetails } from "./profile-details-service";

export async function ClientProfilePage() {
  const [profile, details] = await Promise.all([
    getClientContactProfile(),
    getClientProfileDetails(),
  ]);

  return (
    <div className="dashboard-page">
        <div className="dashboard-profile-content layout-stack">
          <div className="client-profile-intro">
            <p className="type-label dashboard-kicker">Profile & intake</p>
            <h1 className="type-heading-1 text-text">Your candidate profile</h1>
            <p className="type-body text-text-muted">
              Keep your contact, professional link and mobility details current.
              Your package is visible here and managed by Zevantaa.
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
            {profile && details ? (
              <>
                <ContactProfileForm profile={profile} />
                <div className="client-profile-section-divider">
                  <h2 className="type-heading-3 text-text">Professional link & mobility</h2>
                  <p className="type-supporting text-text-muted">
                    Add your LinkedIn profile and current location, then confirm
                    your relocation preference.
                  </p>
                </div>
                <ProfileDetailsForm details={details} />
              </>
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
            <p className="type-body text-text-muted">Experience, education, skills and source resume uploads are not editable yet. Package changes remain with the administrator.</p>
          </section>
        </div>
    </div>
  );
}
