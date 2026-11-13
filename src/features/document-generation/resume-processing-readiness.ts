import { createHash } from "node:crypto";

import type { ResumeExtractionResult } from "@/types/resume-extraction";

import { parseResumeReview, type ResumeReviewProposal } from "./resume-review-parser";

export type ResumeProcessingFindingCode =
  | "source-temporarily-unavailable"
  | "source-unreadable"
  | "source-needs-replacement"
  | "ambiguous-career-facts"
  | "missing-substantive-career-history"
  | "client-confirmation-required"
  | "existing-profile-merge-required";

export type ResumeProcessingFinding = {
  code: ResumeProcessingFindingCode;
  message: string;
};

export type ResumeProcessingAssessment =
  | {
      outcome: "retry";
      errorCode: "source-unavailable" | "unsafe-storage-reference";
      findings: ResumeProcessingFinding[];
    }
  | {
      outcome: "completed" | "needs-input";
      extractor: ResumeExtractionResult["extractor"];
      normalizedTextSha256: string | null;
      findings: ResumeProcessingFinding[];
      structuredResult: {
        schemaVersion: 1;
        sourceFileId: string | null;
        pageCount: number | null;
        autoAcceptable: boolean;
        proposals: ResumeReviewProposal[];
        parserWarnings: string[];
        extractionWarnings: ResumeExtractionResult["warnings"];
      };
    };

const nonCriticalAbsence = /^No unambiguous (employment|education|skills|certifications) entries were proposed\.$/;

/**
 * A deliberately conservative gate. The strict parser proposes only facts it
 * can map deterministically. Any unresolved/ambiguous structure blocks
 * automatic acceptance, while an absent optional section alone does not.
 */
export function assessResumeExtraction(extraction: ResumeExtractionResult): ResumeProcessingAssessment {
  if (extraction.status !== "success" || !extraction.normalizedText || !extraction.extractor) {
    if (extraction.failureReason === "source-unavailable" ||
        extraction.failureReason === "unsafe-storage-reference") {
      return {
        outcome: "retry",
        errorCode: extraction.failureReason,
        findings: [{
          code: "source-temporarily-unavailable",
          message: "The private source resume could not be read safely. Processing will retry automatically.",
        }],
      };
    }
    const replace = extraction.failureReason === "encrypted-file" ||
      extraction.failureReason === "active-content" ||
      extraction.failureReason === "unsupported-format" ||
      extraction.failureReason === "extraction-limit";
    const findings: ResumeProcessingFinding[] = [{
      code: replace ? "source-needs-replacement" : "source-unreadable",
      message: replace
        ? "Upload an unlocked DOC, DOCX, or text-based PDF that meets the file limits."
        : "The resume could not be read reliably. Upload a text-based file or enter the missing career details.",
    }];
    return {
      outcome: "needs-input",
      extractor: extraction.extractor,
      normalizedTextSha256: null,
      findings,
      structuredResult: {
        schemaVersion: 1,
        sourceFileId: extraction.sourceFileId,
        pageCount: extraction.pageCount,
        autoAcceptable: false,
        proposals: [],
        parserWarnings: [],
        extractionWarnings: extraction.warnings,
      },
    };
  }

  const draft = parseResumeReview(extraction.normalizedText);
  const findings: ResumeProcessingFinding[] = [];
  const criticalWarnings = draft.warnings.filter((warning) => !nonCriticalAbsence.test(warning));
  if (criticalWarnings.length || extraction.warnings.length) {
    findings.push({
      code: "ambiguous-career-facts",
      message: "Some source content could not be mapped unambiguously. Review only the highlighted details.",
    });
  }
  const substantive = draft.proposals.some((proposal) =>
    proposal.section === "employment" || proposal.section === "education" || proposal.section === "projects");
  if (!substantive) {
    findings.push({
      code: "missing-substantive-career-history",
      message: "Add at least one supported employment, education, or project entry before documents are generated.",
    });
  }

  const autoAcceptable = findings.length === 0;
  findings.push({
    code: "client-confirmation-required",
    message: autoAcceptable
      ? "Review the extracted details and confirm the facts before documents are generated."
      : "Correct the highlighted details and confirm the supported facts before documents are generated.",
  });
  return {
    outcome: "needs-input",
    extractor: extraction.extractor,
    normalizedTextSha256: createHash("sha256").update(extraction.normalizedText).digest("hex"),
    findings,
    structuredResult: {
      schemaVersion: 1,
      sourceFileId: extraction.sourceFileId,
      pageCount: extraction.pageCount,
      // This records parser confidence only. Explicit client confirmation is
      // still the publication boundary for every newly uploaded source.
      autoAcceptable,
      proposals: draft.proposals,
      parserWarnings: draft.warnings,
      extractionWarnings: extraction.warnings,
    },
  };
}

/** Prevent a replacement source from silently appending to canonical facts. */
export function requireExistingProfileMergeInput(
  assessment: Extract<ResumeProcessingAssessment, { outcome: "completed" | "needs-input" }>,
): Extract<ResumeProcessingAssessment, { outcome: "completed" | "needs-input" }> {
  if (assessment.outcome !== "completed") return assessment;
  return {
    ...assessment,
    outcome: "needs-input",
    findings: [{
      code: "existing-profile-merge-required",
      message: "Review the extracted details against the existing profile before replacing or adding career facts.",
    }],
    structuredResult: { ...assessment.structuredResult, autoAcceptable: false },
  };
}
