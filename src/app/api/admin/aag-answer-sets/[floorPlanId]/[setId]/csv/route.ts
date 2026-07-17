import { NextResponse } from "next/server";

import { isAagFloorPlanId, isAagSetId } from "@/lib/aag-answer-set";
import { exportAagAnswerSetCsv } from "@/lib/aag-answer-set-server";
import { getCurrentAdmin } from "@/lib/admin-session";

interface RouteContext {
  params: Promise<{ floorPlanId: string; setId: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { floorPlanId, setId } = await context.params;
  if (!isAagFloorPlanId(floorPlanId) || !isAagSetId(setId)) {
    return NextResponse.json({ message: "Unknown floor plan or set identifier." }, { status: 404 });
  }

  try {
    const csv = await exportAagAnswerSetCsv(floorPlanId, setId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${floorPlanId}-${setId}-aag-answer-markers.csv\"`,
      },
    });
  } catch (error) {
    console.error("Unable to export AAG answer set", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "AAG answer set could not be exported." },
      { status: 409 },
    );
  }
}
