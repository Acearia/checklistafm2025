import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const LOCAL_SUPABASE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const resolveSupabaseUrlForClient = (rawUrl?: string) => {
  if (!rawUrl || typeof window === "undefined") {
    return rawUrl;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const isSupabaseLocalHost = LOCAL_SUPABASE_HOSTS.has(parsedUrl.hostname);
    const browserHost = window.location.hostname;
    const browserIsLocalHost = LOCAL_BROWSER_HOSTS.has(browserHost);

    if (!isSupabaseLocalHost || browserIsLocalHost) {
      return rawUrl;
    }

    // On mobile devices, "localhost" points to the phone itself. Reuse the current host.
    parsedUrl.hostname = browserHost;
    return parsedUrl.toString();
  } catch {
    return rawUrl;
  }
};

const SUPABASE_URL = resolveSupabaseUrlForClient(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
