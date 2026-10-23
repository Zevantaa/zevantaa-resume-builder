/** The configured app origin, never a forwarding header or caller-supplied URL. */
export function getCanonicalRecoveryOrigin(
  configured: string | undefined,
  production: boolean,
): string | null {
  if (!configured) return null;
  try {
    const url = new URL(configured.trim());
    const localHttp = !production && url.protocol === "http:" && url.hostname === "localhost";
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
