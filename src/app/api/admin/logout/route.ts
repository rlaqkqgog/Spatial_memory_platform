import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", maxAge: 0, path: "/" });
  return response;
}
