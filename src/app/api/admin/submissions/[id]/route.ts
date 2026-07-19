import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/admin-session";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 관리자가 하나의 위치 응답과 그에 연결된 우연객체 응답을 함께 삭제합니다. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ message: "잘못된 제출 식별자입니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 먼저 연결된 우연객체 응답을 지웁니다(응답 행은 cascade로 함께 삭제됩니다).
  const { error: incidentalError } = await supabase
    .from("incidental_recognition_submissions")
    .delete()
    .eq("main_submission_id", id);
  if (incidentalError) {
    console.error("Failed to delete linked incidental submissions", incidentalError);
    return NextResponse.json({ message: "우연객체 응답 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 위치 응답을 지웁니다(마커·이벤트는 cascade로 함께 삭제됩니다).
  const { error } = await supabase.from("experiment_submissions").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete submission", error);
    return NextResponse.json({ message: "응답 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ deletedId: id });
}
