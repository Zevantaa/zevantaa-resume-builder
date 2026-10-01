import type { CandidateProfile } from "@/types/client-profile";

const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const ordered = (number: number) => ({ id: id(number), sortOrder: number });
const longBullet = "Documented a fictional cross-functional handoff between inventory, transport, reporting, and service teams, recording the candidate-supplied sequence without claiming a measured outcome.";

/** Static, fictional canonical record for stress-testing the real Global ATS template. */
export function createLongGlobalAtsQaProfile(): CandidateProfile {
  return {
    id: id(1), createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z",
    fullName: "Rohan Kapoor Fictional International Operations and Supply Chain Candidate",
    primaryEmail: "rohan.kapoor.qa@example.invalid", mobileNumber: "+91 90000 00000",
    whatsappNumber: "+91 90000 00001",
    linkedinUrl: "https://www.linkedin.com/in/fictional-rohan-kapoor-operations-supply-chain-regional-distribution-quality-planning",
    currentLocation: "Fictional Chandigarh Regional Operations and Distribution Coordination Office",
    relocationPreference: "open", selectedPackage: "indian-domestic", targetMarkets: ["indian-domestic"],
    professionalSummary: Array.from({ length: 4 }, (_, index) =>
      `Candidate-supplied fictional summary paragraph ${index + 1}: coordinated operations planning, inventory reporting, and documented process handoffs across multiple regional teams. This text is only for layout QA and does not represent a real person.`).join("\n\n"),
    workExperience: Array.from({ length: 6 }, (_, index) => ({
      ...ordered(10 + index),
      jobTitle: `Senior Fictional Operations and Supply Chain Programme Coordination Manager — Regional Planning Division ${index + 1}`,
      employerName: `Fictional International Distribution and Business Process Cooperative — Regional Office ${index + 1}`,
      location: `Fictional North-West Regional Logistics and Service Coordination Centre ${index + 1}`,
      startDate: `${2014 + index}-01`,
      ...(index < 5 ? { endDate: `${2014 + index}-12` } : {}), currentRole: index === 5,
      description: `Candidate-supplied fictional responsibilities for role ${index + 1}: coordinated documented planning, reporting, and operational review activities across several teams.`,
      highlights: Array.from({ length: 4 }, (_, bullet) => `Role ${index + 1}, supplied bullet ${bullet + 1}. ${longBullet} ${longBullet}`),
    })),
    education: [
      { ...ordered(30), qualification: "Master of Business Administration (Operations)", institutionName: "Fictional Regional University", completionYear: 2017, gradeResult: "CGPA 8.1/10", highlights: [] },
      { ...ordered(31), qualification: "Bachelor of Commerce", institutionName: "Example City College", startDate: "2012-07", endDate: "2015-05", highlights: [] },
    ],
    skills: Array.from({ length: 24 }, (_, index) => ({ ...ordered(40 + index), name: `Verified fictional operations skill ${index + 1}` })),
    certifications: [
      { ...ordered(70), name: "Fictional Lean Six Sigma Green Belt", issuingOrganization: "Example Training Institute", issueYear: 2021 },
      { ...ordered(71), name: "Fictional Advanced Reporting Certificate", issuingOrganization: "Example Academy", issuedOn: "2020-05" },
    ],
    projects: [{ ...ordered(80), name: "Fictional Regional Reporting Project", role: "Coordinator", startDate: "2021-02", endDate: "2021-09",
      description: "Candidate-supplied fictional project description covering a documented reporting pilot.",
      highlights: [`Project-supplied bullet. ${longBullet}`], technologies: ["Spreadsheet reporting"] }],
    languages: [{ ...ordered(90), name: "English", proficiency: "fluent" }, { ...ordered(91), name: "Hindi", proficiency: "professional-working" }],
    additionalSections: [{ ...ordered(100), title: "Additional Information", items: [
      { ...ordered(101), heading: "Fictional Community Logistics Volunteer", description: "Candidate-supplied fictional volunteer coordination description.", highlights: [`Volunteer-supplied bullet. ${longBullet}`] },
    ] }],
  };
}
