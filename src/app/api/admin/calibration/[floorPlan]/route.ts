import { NextResponse } from "next/server";

import type { CalibrationPoint } from "@/lib/answer-key";
import { setCalibration } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";
import { FLOOR_PLANS, type FloorPlan } from "@/types/experiment";

function isValidPoint(value: unknown): value is CalibrationPoint {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const point = value as Record<string, unknown>;
  return (
    typeof point.plan_x === "number" &&
    Number.isFinite(point.plan_x) &&
    point.plan_x >= 0 &&
    point.plan_x <= 1 &&
    typeof point.plan_y === "number" &&
    Number.isFinite(point.plan_y) &&
    point.plan_y >= 0 &&
    point.plan_y <= 1 &&
    typeof point.world_x === "number" &&
    Number.isFinite(point.world_x) &&
    typeof point.world_z === "number" &&
    Number.isFinite(point.world_z)
  );
}

/** 평면도별 캘리브레이션 기준점을 저장합니다. */
export async function PUT(request: Request, { params }: { params: Promise<{ floorPlan: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const { floorPlan } = await params;
  if (!FLOOR_PLANS.includes(floorPlan as FloorPlan)) {
    return NextResponse.json({ message: "잘못된 평면도입니다." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON 형식의 요청 본문이 필요합니다." }, { status: 400 });
  }

  const referencePoints = (body as { referencePoints?: unknown }).referencePoints;
  if (!Array.isArray(referencePoints) || !referencePoints.every(isValidPoint)) {
    return NextResponse.json({ message: "기준점 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const normalized: CalibrationPoint[] = referencePoints.map((point) => ({
    plan_x: point.plan_x,
    plan_y: point.plan_y,
    world_x: point.world_x,
    world_z: point.world_z,
  }));

  try {
    await setCalibration(floorPlan as FloorPlan, normalized);
    return NextResponse.json({ floorPlan, count: normalized.length });
  } catch (error) {
    console.error("Failed to set calibration", error);
    return NextResponse.json({ message: "캘리브레이션 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
