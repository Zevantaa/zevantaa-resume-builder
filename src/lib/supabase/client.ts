import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient() {
  const { key, url } = getSupabasePublicConfig();

  browserClient ??= createBrowserClient(url, key);

  return browserClient;
}
