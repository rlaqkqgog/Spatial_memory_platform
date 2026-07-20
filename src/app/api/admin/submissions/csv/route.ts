import { attachmentContentDisposition, buildSubmissionsCsv } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";

/** 모든 위치 응답을 정답 CSV와 같은 형식으로 한 파일에 내려받습니다. */
export async function GET() {
  if (!(await getCurrentAdmin())) {
    return new Response("Administrator authentication is required.", { status: 401 });
  }

  const result = await buildSubmissionsCsv();
  if (!result) {
    return new Response("제출된 응답이 없습니다.", { status: 404 });
  }

  return new Response(`﻿${result.csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentContentDisposition(`${result.label}.csv`),
    },
  });
}
