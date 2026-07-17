import { NextResponse } from "next/server";

import { isAagFloorPlanId, isAagSetId, type AagAnswerSetStatus } from "@/lib/aag-answer-set";
import { setAagAnswerSetStatus } from "@/lib/aag-answer-set-server";
import { getCurrentAdmin } from "@/lib/admin-session";

interface RouteContext {
  params: Promise<{ floorPlanId: string; setId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { floorPlanId, setId } = await context.params;
  if (!isAagFloorPlanId(floorPlanId) || !isAagSetId(setId)) {
    return NextResponse.json({ message: "Unknown floor plan or set identifier." }, { status: 404 });
  }

  let status: unknown;
  try {
    ({ status } = (await request.json()) as { status?: unknown });
  } catch {
    return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  }
  if (status !== "draft" && status !== "ready") {
    return NextResponse.json({ message: "Status must be draft or ready." }, { status: 400 });
  }

  try {
    const answerSet = await setAagAnswerSetStatus(floorPlanId, setId, status as AagAnswerSetStatus);
    return NextResponse.json({ answerSet });
  } catch (error) {
    console.error("Unable to update AAG answer set status", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "AAG answer set status could not be updated." },
      { status: 409 },
    );
  }
}
