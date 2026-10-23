import { mapCandidateProfileToDocumentData } from "../src/features/document-generation/profile-mapper.ts";
import { buildGlobalAtsResumeModel } from "../src/features/document-generation/global-ats-resume.ts";
import { buildDomesticResumeModel } from "../src/features/document-generation/domestic-resumes.ts";
import { buildGccResumeModel } from "../src/features/document-generation/gcc-resume.ts";
import { buildEuropeanResumeModel } from "../src/features/document-generation/european-resume.ts";
import { buildCoverLetterModel } from "../src/features/document-generation/cover-letters.ts";
import { buildPrivacyMaskedEmployerResume } from "../src/features/document-generation/privacy-masked-resume.ts";
import { buildPdfFilename } from "../src/features/document-generation/pdf/pdf-filename.ts";
import { renderPdfDocument } from "../src/features/document-generation/pdf/render-pdf.ts";

/** Legacy layout-route tests mock only persistence; DOC-13 tests exercise real persistence. */
export async function mockPersistedRoutePdf(profile, output, photoLoader) {
  const mapping = mapCandidateProfileToDocumentData(profile,
    output.endsWith("cover-letter") ? "cover-letter" : "resume");
  let result;
  let filename;
  if (output === "global-ats-employer-masked") {
    const masked = buildPrivacyMaskedEmployerResume(mapping);
    result = { model: masked.model };
    filename = buildPdfFilename({ candidateName: masked.referenceId, output: "global-ats-resume", privacyMasked: true });
  } else {
    filename = buildPdfFilename({ candidateName: profile.fullName, output });
    if (output === "global-ats-resume") result = { model: buildGlobalAtsResumeModel(mapping) };
    else if (output.startsWith("domestic-resume-")) result = buildDomesticResumeModel(mapping, output.slice(-1));
    else if (output === "gcc-resume") {
      const photo = photoLoader ? await photoLoader(profile.id) : null;
      const trusted = photo ? mapCandidateProfileToDocumentData({ ...profile, gccPhoto: photo.reference }, "resume") : mapping;
      result = buildGccResumeModel(trusted, photo ? `data:image/png;base64,${Buffer.from(photo.png).toString("base64")}` : undefined);
    } else if (output === "europass-eu-resume") result = buildEuropeanResumeModel(mapping);
    else result = buildCoverLetterModel(mapping, output.slice(0, -"-cover-letter".length));
  }
  return { bytes: new Uint8Array(await renderPdfDocument(result.model, result.theme)), filename, id: "mock-stored", version: 1 };
}
