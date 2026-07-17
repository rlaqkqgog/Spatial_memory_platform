import { NextResponse } from "next/server";

import { listAagAnswerSets } from "@/lib/aag-answer-set-server";
import { getCurrentAdmin } from "@/lib/admin-session";

export async function GET() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  try {
    return NextResponse.json({ answerSets: await listAagAnswerSets() });
  } catch (error) {
    console.error("Unable to list AAG answer sets", error);
    return NextResponse.json(
      { message: "AAG answer sets could not be loaded. Confirm that migration 202607140001 has been applied." },
      { status: 500 },
    );
  }
}
