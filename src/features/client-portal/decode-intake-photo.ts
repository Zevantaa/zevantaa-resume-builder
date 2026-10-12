import "server-only";

import sharp from "sharp";

import { IntakeFileValidationError } from "./intake-file-validation";

/** Full decode runs on the server only, after shared MIME/signature checks. */
export async function validateDecodedIntakePhoto(bytes: Uint8Array, extension: string): Promise<void> {
  try {
    const image = sharp(bytes, { failOn: "error", limitInputPixels: 12_000_000 });
    const details = await image.metadata();
    const expectedFormat = extension === "jpg" ? "jpeg" : extension;
    if (details.format !== expectedFormat || !details.width || !details.height ||
        details.width > 4000 || details.height > 4000) {
      throw new Error("Unsupported image dimensions or format.");
    }
    await image.stats();
  } catch {
    throw new IntakeFileValidationError("The photograph could not be decoded safely.", "photo");
  }
}
