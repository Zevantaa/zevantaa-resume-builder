/** Browser-safe messages; never show a server response body or Storage/DB detail. */
export function pdfRequestFailureMessage(status: number, redirected: boolean): string {
  if (redirected || status === 401) return "Your session has expired. Sign in again, then retry.";
  if (status === 403) return "You do not have permission to generate this document.";
  if (status === 404) return "This document or client is unavailable.";
  if (status === 422) return "The profile is not ready or the assigned package does not include this output. Review the package and required profile details.";
  return "The PDF could not be generated. Please try again or contact Zevantaa support.";
}

/** Read only the server-supplied filename and fall back safely. */
export function pdfDownloadName(header: string | null): string {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = header?.match(/filename="?([^";]+)"?/i)?.[1];
  let candidate = plain;
  try { if (encoded) candidate = decodeURIComponent(encoded); } catch { /* Use the safe fallback. */ }
  return candidate && /^[\p{L}\p{N}\p{M}_ .()-]+\.pdf$/iu.test(candidate) ? candidate : "Zevantaa_Document.pdf";
}
