/** Validate candidate-supplied links before storing/rendering them. No network request is made. */
export function isSafeExternalUrl(value: string): boolean {
  if (!value || value.length > 2048 || /[\u0000-\u0020\u007f]/u.test(value)) return false;
  try {
    const url = new URL(value);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password ||
        !url.hostname || url.port) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
        host.endsWith(".internal") || host === "0.0.0.0" || host === "[::1]" ||
        /^\d+(?:\.\d+){3}$/u.test(host) || !host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}
