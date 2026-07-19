import { NextResponse } from "next/server";

import { deleteAnswerKey } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ message: "잘못된 식별자입니다." }, { status: 400 });
  }

  try {
    await deleteAnswerKey(id);
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    console.error("Failed to delete answer key", error);
    return NextResponse.json({ message: "정답 세트 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
