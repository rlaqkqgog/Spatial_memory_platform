import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isAdminUser, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

interface LoginRequest {
  email?: unknown;
  password?: unknown;
}

interface ValidLoginRequest {
  email: string;
  password: string;
}

function isLoginRequest(value: unknown): value is ValidLoginRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const { email, password } = value as LoginRequest;
  return (
    typeof email === "string" &&
    email.trim().length > 0 &&
    email.length <= 254 &&
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 256
  );
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json(
      { message: "관리자 로그인 환경 변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "로그인 요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (!isLoginRequest(body)) {
    return NextResponse.json({ message: "이메일과 8자 이상의 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email.trim(),
    password: body.password,
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (!(await isAdminUser(data.user.id))) {
    return NextResponse.json({ message: "이 계정에는 관리자 권한이 없습니다." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: data.session.access_token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.max(60, data.session.expires_in),
    path: "/",
  });

  return response;
}
