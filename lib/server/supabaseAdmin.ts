import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdminClient: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function getRequiredUrlEnv(name: string): string {
  const value = getRequiredEnv(name);

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error(`${name} must use HTTPS in production.`);
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
}

function getSupabaseServiceRoleKey(): string {
  const key = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (key.length < 32) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY appears invalid.");
  }

  return key;
}

export function createSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = getRequiredUrlEnv("SUPABASE_URL");
  const serviceRoleKey = getSupabaseServiceRoleKey();

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "tates-retro-tv-admin-server",
      },
    },
  });

  return cachedAdminClient;
}