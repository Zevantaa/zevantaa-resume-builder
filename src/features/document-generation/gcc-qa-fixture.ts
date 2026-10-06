import "server-only";

import sharp from "sharp";

import { createLongGlobalAtsQaProfile } from "./global-ats-qa-fixture";

/** Fictional GCC-eligible canonical data; no production candidate or storage object. */
export function createGccQaProfile(long = false) {
  const profile = createLongGlobalAtsQaProfile();
  profile.selectedPackage = "gcc-middle-east";
  profile.targetMarkets = ["gcc-middle-east"];
  if (!long) {
    profile.professionalSummary = "Candidate-supplied fictional operations and supply-chain summary for regional resume layout QA.";
    profile.workExperience = profile.workExperience.slice(0, 2).map((role) => ({
      ...role, highlights: role.highlights.slice(0, 1),
    }));
    profile.education = profile.education.slice(0, 1);
    profile.skills = profile.skills.slice(0, 8);
    profile.certifications = profile.certifications.slice(0, 1);
  }
  return profile;
}

/** Original programmatic, non-person portrait test image. No external or real-person asset. */
export async function createGccQaPhoto(): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: {
    width: 480, height: 640, channels: 3,
    background: { r: 76, g: 112, b: 123 },
  } }).png().toBuffer());
}

/** Fixture-only presentation image; production photos use the validated private resolver. */
export async function createGccQaPhotoDataUri(): Promise<string> {
  const png = await sharp(await createGccQaPhoto())
    .resize(240, 300, { fit: "cover", position: "centre" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
