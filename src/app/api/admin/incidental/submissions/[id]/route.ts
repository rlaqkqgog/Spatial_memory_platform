import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/admin-session";
import { setIncidentalSession } from "@/lib/incidental-server";
import { buildExperimentCode, FLOOR_PLANS, SESSION_NUMBERS } from "@/types/experiment";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_EXPERIMENT_CODES = new Set(
  FLOOR_PLANS.flatMap((floorPlan) => SESSION_NUMBERS.map((sessionNumber) => buildExperimentCode(floorPlan, sessionNumber))),
);

/** 우연객체 제출의 세션(experiment_code)을 관리자가 직접 수정합니다. 응답의 정답 여부도 새 세션 기준으로 재계산됩니다. */
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

  const experimentCode = (body as { experimentCode?: unknown }).experimentCode;
  if (typeof experimentCode !== "string" || !VALID_EXPERIMENT_CODES.has(experimentCode)) {
    return NextResponse.json({ message: "지원하지 않는 세션 코드입니다." }, { status: 400 });
  }

  try {
    await setIncidentalSession(id, experimentCode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update incidental session", error);
    return NextResponse.json({ message: "세션 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}
