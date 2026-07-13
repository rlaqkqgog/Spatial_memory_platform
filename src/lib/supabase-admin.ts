import "server-only";

import { createClient } from "@supabase/supabase-js";

interface SupabaseAdminConfig {
  url: string;
  secretKey: string;
}

/** 서버에서만 쓸 Supabase Secret key 설정을 반환합니다. */
export function getSupabaseAdminConfig(): SupabaseAdminConfig | null {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    return null;
  }

  return { url, secretKey };
}

/** RLS를 우회하는 서버 전용 클라이언트입니다. 클라이언트 컴포넌트에서 import하면 안 됩니다. */
export function createSupabaseAdminClient() {
  const config = getSupabaseAdminConfig();
  if (!config) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
