import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazily-created Supabase client.
 *
 * The client is only instantiated on first access, so a missing
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time doesn't crash
 * the build — it only surfaces when the Online page actually tries to use it.
 * If either env var is missing at runtime, throw a clear error so the UI can
 * catch it and render a helpful message.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client !== null) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase env vars missing. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY in .env.local (or Vercel project settings).',
    );
  }
  client = createClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

/** Check if the env vars are present (without instantiating the client). */
export function hasSupabaseConfig(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return Boolean(url && anonKey);
}
