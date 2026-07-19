import { NextResponse } from "next/server";

import { parseAnswerKeyCsv } from "@/lib/answer-key";
import { recordAnswerKey } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";

/** 정답 CSV 텍스트를 업로드해 저장합니다. */
export async function POST(request: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON 형식의 요청 본문이 필요합니다." }, { status: 400 });
  }

  const csv = (body as { csv?: unknown }).csv;
  const filename = (body as { filename?: unknown }).filename;
  if (typeof csv !== "string" || csv.trim().length === 0) {
    return NextResponse.json({ message: "CSV 내용이 비어 있습니다." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseAnswerKeyCsv(csv);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "CSV를 파싱하지 못했습니다." },
      { status: 400 },
    );
  }

  try {
    const id = await recordAnswerKey(parsed, typeof filename === "string" ? filename : null);
    return NextResponse.json({
      id,
      participantId: parsed.participantId,
      floorPlan: parsed.floorPlan,
      sessionNumber: parsed.sessionNumber,
      stoneCount: parsed.stones.length,
    });
  } catch (error) {
    console.error("Failed to record answer key", error);
    return NextResponse.json({ message: "정답 세트 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
