import { getPackageRouting } from "@/features/document-generation/package-routing";
import type { PdfOutputKind } from "@/features/document-generation/pdf/pdf-filename";
import type { IndicativeAtsScore } from "@/features/document-generation/indicative-ats-score";

import type { ClientDashboardEvidence } from "./client-dashboard-service";
import type { ClientDashboardSummary } from "./contact-profile-service";

export const OUTPUT_TITLES: Record<PdfOutputKind, string> = {
  "global-ats-resume": "Global ATS Resume",
  "domestic-resume-1": "Domestic Resume 1 · Executive Classic",
  "domestic-resume-2": "Domestic Resume 2 · Modern Professional",
  "domestic-resume-3": "Domestic Resume 3 · Compact High-Density",
  "domestic-resume-4": "Domestic Resume 4 · Contemporary Sidebar",
  "domestic-resume-5": "Domestic Resume 5 · Premium Minimal",
  "gcc-resume": "GCC / Middle East Resume",
  "europass-eu-resume": "Europass / EU Resume",
  "general-corporate-cover-letter": "General Corporate Cover Letter",
  "international-relocation-cover-letter": "International Relocation Cover Letter",
  "technology-startup-cover-letter": "Technology & Startup Cover Letter",
};

/** Entitlement, readiness, and a persisted downloadable file remain separate. */
export function buildClientDashboardView(
  summary: ClientDashboardSummary | null,
  evidence: ClientDashboardEvidence | null,
  score: IndicativeAtsScore | null,
) {
  const routing = summary && evidence?.packageCode === summary.packageCode
    ? getPackageRouting(summary.packageCode) : null;
  const resumeAvailable = evidence?.resume?.status === "available";
  const reviewConfirmed = Boolean(resumeAvailable && evidence?.reviewConfirmed);
  const updates = Object.values(evidence?.documentUpdates ?? {});
  const expectedOutputs = routing?.allowedOutputs.length ?? 0;
  const availableOutputs = Object.keys(evidence?.downloadableDocuments ?? {}).length;
  const profileStatus = !summary || !evidence || !resumeAvailable
    ? "Profile setup incomplete"
    : !reviewConfirmed ? "Resume processing or input required"
      : updates.includes("failed") ? "Document generation needs attention"
        : updates.includes("updating") ? "Document generation in progress"
          : expectedOutputs > 0 && availableOutputs >= expectedOutputs
            ? "Documents ready"
            : score?.status === "ready" ? "Document publication pending" : "Profile reviewed/confirmed";
  const outputs = (routing?.allowedOutputs ?? []).map((output) => {
    const documentId = evidence?.downloadableDocuments[output] ?? null;
    return {
      id: output,
      label: OUTPUT_TITLES[output],
      documentId,
      state: documentId ? "Download available"
        : evidence?.documentUpdates?.[output] === "failed" ? "Update failed"
          : evidence?.documentUpdates?.[output] === "updating" ? "Updating"
            : !reviewConfirmed
        ? "Available when profile details are ready" : score?.status === "ready"
          ? "Queued automatically" : "Not yet available",
    };
  });
  return { routing, profileStatus, outputs, resumeAvailable, reviewConfirmed,
    photoAvailable: evidence?.photo?.status === "available" };
}
