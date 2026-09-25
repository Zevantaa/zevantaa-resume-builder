export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase authentication is not configured. Add the public project URL and publishable key to the application environment.",
    );
    this.name = "SupabaseConfigurationError";
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const supabaseLegacyAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function isPlaceholder(value: string | undefined) {
  return !value || value.includes("your-supabase-") || value.includes("your-project-ref");
}

export function isSupabaseConfigured() {
  const key = supabasePublishableKey || supabaseLegacyAnonKey;

  return !isPlaceholder(supabaseUrl) && !isPlaceholder(key);
}

export function getSupabasePublicConfig() {
  const key = supabasePublishableKey || supabaseLegacyAnonKey;

  if (!isSupabaseConfigured() || !supabaseUrl || !key) {
    throw new SupabaseConfigurationError();
  }

  return {
    key,
    url: supabaseUrl,
  } as const;
}
