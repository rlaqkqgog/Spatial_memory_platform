import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/admin-session";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { SESSION_NUMBERS } from "@/types/experiment";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 관리자가 하나의 위치 응답에 세션(S1~S3)을 수동 매칭하거나 해제합니다. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ message: "잘못된 제출 식별자입니다." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON 형식의 요청 본문이 필요합니다." }, { status: 400 });
  }

  const sessionNumber = (body as { sessionNumber?: unknown }).sessionNumber;
  const normalizedSession =
    sessionNumber === null || sessionNumber === ""
      ? null
      : SESSION_NUMBERS.includes(sessionNumber as (typeof SESSION_NUMBERS)[number])
        ? (sessionNumber as string)
        : undefined;

  if (normalizedSession === undefined) {
    return NextResponse.json({ message: "세션 값이 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("set_submission_session", {
    p_submission_id: id,
    p_session_number: normalizedSession,
  });

  if (error) {
    console.error("Failed to set submission session", error);
    return NextResponse.json({ message: "세션 저장 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ sessionNumber: normalizedSession });
}
