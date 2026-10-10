import Link from "next/link";

import { InlineAlert } from "@/components/ui";
import { ClientCareerEditor } from "@/features/client-portal/client-career-editor";
import { toCareerDraft } from "@/features/client-portal/career-profile-model";
import { getCurrentClientCareerProfile } from "@/features/client-portal/career-profile-service";
import { getCurrentClientSkillLibrary } from "@/features/client-portal/skill-library-service";

export const dynamic = "force-dynamic";

export default async function ClientCareerProfilePage() {
  const [snapshot, skillLibrary] = await Promise.all([getCurrentClientCareerProfile(), getCurrentClientSkillLibrary()]);
  return <div className="dashboard-page career-v8-page">
    <header className="career-v8-page-intro">
      <p className="type-label dashboard-kicker">Client portal · Career updates</p>
      <h1 className="type-heading-1">Update Career Profile</h1>
      <p className="type-body text-text-muted">Edit only career information you can verify. Zevantaa manages your identity, contact, location and package separately.</p>
    </header>
    {!snapshot ? <InlineAlert variant="error">Your linked profile is unavailable. Contact Zevantaa support.</InlineAlert>
      : <ClientCareerEditor key={snapshot.revision} initial={toCareerDraft(snapshot.profile)} revision={snapshot.revision} skillLibrary={skillLibrary} />}
    <Link className="type-button dashboard-text-link" href="/client/profile">View read-only contact details and uploads</Link>
  </div>;
}
