import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/admin-session";
import { setIncidentalManualGrade } from "@/lib/incidental-server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 우연객체 응답 하나의 정답/오답을 수동으로 덮어씁니다. manualCorrect: true=정답, false=오답, null=자동. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ message: "잘못된 식별자입니다." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON 형식의 요청 본문이 필요합니다." }, { status: 400 });
  }

  const manualCorrect = (body as { manualCorrect?: unknown }).manualCorrect;
  if (!(manualCorrect === null || typeof manualCorrect === "boolean")) {
    return NextResponse.json({ message: "manualCorrect는 true, false, null 중 하나여야 합니다." }, { status: 400 });
  }

  try {
    await setIncidentalManualGrade(id, manualCorrect);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to set incidental manual grade", error);
    return NextResponse.json({ message: "수동 채점 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
