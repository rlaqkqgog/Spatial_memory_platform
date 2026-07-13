import "server-only";

import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const ADMIN_SESSION_COOKIE = "spatial_memory_admin_token";

export interface AdminIdentity {
  id: string;
  email: string;
}

/** Supabase Auth 사용자 중 admin_users 허용 목록에 있는지 확인합니다. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Unable to check administrator role", error);
    return false;
  }

  return data !== null;
}

/** HTTP-only 쿠키의 access token을 검증하고 현재 관리자 정보를 반환합니다. */
export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user || !user.email || !(await isAdminUser(user.id))) {
    return null;
  }

  return { id: user.id, email: user.email };
}
