import { buildSubmissionsCsv } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 하나의 위치 응답을 정답 CSV와 같은 형식으로 내려받습니다. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return new Response("Administrator authentication is required.", { status: 401 });
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return new Response("잘못된 식별자입니다.", { status: 400 });
  }

  const result = await buildSubmissionsCsv(id);
  if (!result) {
    return new Response("해당 응답을 찾을 수 없습니다.", { status: 404 });
  }

  return new Response(`﻿${result.csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.label}.csv"`,
    },
  });
}
