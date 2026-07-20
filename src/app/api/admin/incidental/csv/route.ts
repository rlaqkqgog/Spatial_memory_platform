import { attachmentContentDisposition } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { buildIncidentalCsv } from "@/lib/incidental-server";

/** 우연객체 재인 응답 전체를 CSV로 내려받습니다. */
export async function GET() {
  if (!(await getCurrentAdmin())) {
    return new Response("Administrator authentication is required.", { status: 401 });
  }

  const csv = await buildIncidentalCsv();
  if (!csv) {
    return new Response("우연객체 응답이 없습니다.", { status: 404 });
  }

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": attachmentContentDisposition("incidental_recognition_all.csv"),
    },
  });
}
