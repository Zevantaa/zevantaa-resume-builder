import type { ResumeReviewProposal } from "./resume-review-parser";

const fieldsBySection: Record<ResumeReviewProposal["section"], readonly string[]> = {
  summary: ["text"], employment: ["jobTitle", "employerName", "location", "startDate", "endDate", "isCurrentRole", "description", "highlights"],
  education: ["qualification", "institutionName", "startDate", "endDate", "completionYear", "gradeResult"], skills: ["name"],
  certifications: ["name", "issuingOrganization", "issuedOn", "issueYear", "expiresOn", "expiryYear"],
  languages: ["name", "proficiency"], projects: ["name", "description", "highlights"], additional: ["heading", "description"],
};
const month = /^\d{4}-(0[1-9]|1[0-2])$/;
const year = /^\d{4}$/;
const languageProficiency = new Set(["", "basic", "conversational", "professional-working", "fluent", "native-or-bilingual"]);

export function reviewedEntries(formData: FormData, proposals: ResumeReviewProposal[]): ResumeReviewProposal[] | null {
  const approved: ResumeReviewProposal[] = [];
  for (const proposal of proposals) {
    if (formData.get(`accept:${proposal.id}`) !== "on") continue;
    const fields: Record<string, string> = {};
    for (const key of fieldsBySection[proposal.section]) {
      const value = formData.get(`field:${proposal.id}:${key}`);
      if (typeof value !== "string" || value.length > 5000) return null;
      fields[key] = value.trim();
    }
    if (Object.values(fields).some((value) => /[\u0000-\u0008\u000e-\u001f]/.test(value))) return null;
    if (proposal.section === "employment" && (!fields.jobTitle || !fields.employerName || !month.test(fields.startDate) ||
        (fields.endDate && !month.test(fields.endDate)) || !["true", "false"].includes(fields.isCurrentRole) ||
        (fields.isCurrentRole === "true" && fields.endDate) || (fields.endDate && fields.endDate < fields.startDate))) return null;
    if (proposal.section === "education" && (!fields.qualification || !fields.institutionName ||
        (fields.startDate && !month.test(fields.startDate)) || (fields.endDate && !month.test(fields.endDate)) ||
        (fields.completionYear && !year.test(fields.completionYear)) || (fields.completionYear && fields.endDate) ||
        (fields.startDate && fields.endDate && fields.endDate < fields.startDate))) return null;
    if (proposal.section === "certifications" && (!fields.name || !fields.issuingOrganization ||
        (fields.issuedOn && !month.test(fields.issuedOn)) || (fields.expiresOn && !month.test(fields.expiresOn)) ||
        (fields.issueYear && !year.test(fields.issueYear)) || (fields.expiryYear && !year.test(fields.expiryYear)) ||
        (fields.issuedOn && fields.issueYear) || (fields.expiresOn && fields.expiryYear) ||
        (fields.issuedOn && fields.expiresOn && fields.expiresOn < fields.issuedOn))) return null;
    if (["skills", "languages", "projects"].includes(proposal.section) && !fields.name) return null;
    if (proposal.section === "languages" && !languageProficiency.has(fields.proficiency)) return null;
    if (proposal.section === "additional" && !fields.heading) return null;
    if (proposal.section === "summary" && !fields.text) return null;
    approved.push({ ...proposal, fields });
  }
  return approved;
}
