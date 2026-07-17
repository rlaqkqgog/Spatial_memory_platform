export const AAG_FLOOR_PLAN_IDS = ["FP1", "FP2"] as const;
export const AAG_SET_IDS = ["S1", "S2", "S3"] as const;
export const AAG_MARKER_COLORS = ["red", "blue", "green", "yellow"] as const;

export type AagFloorPlanId = (typeof AAG_FLOOR_PLAN_IDS)[number];
export type AagSetId = (typeof AAG_SET_IDS)[number];
export type AagMarkerColor = (typeof AAG_MARKER_COLORS)[number];
export type AagAnswerSetStatus = "draft" | "ready";

export interface AagAnswerMarkerInput {
  answerMarkerId: string;
  color: AagMarkerColor;
  label: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  planX: number;
  planY: number;
}

export interface AagAnswerSetValidation {
  markerCount: number;
  colorCounts: Record<AagMarkerColor, number>;
  outOfRangePlanCoordinateCount: number;
  isValid: boolean;
}

export function isAagFloorPlanId(value: string): value is AagFloorPlanId {
  return AAG_FLOOR_PLAN_IDS.includes(value as AagFloorPlanId);
}

export function isAagSetId(value: string): value is AagSetId {
  return AAG_SET_IDS.includes(value as AagSetId);
}

export function isAagMarkerColor(value: unknown): value is AagMarkerColor {
  return typeof value === "string" && AAG_MARKER_COLORS.includes(value as AagMarkerColor);
}

export function validateAagAnswerSet(markers: AagAnswerMarkerInput[]): AagAnswerSetValidation {
  const colorCounts: Record<AagMarkerColor, number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
  };
  let outOfRangePlanCoordinateCount = 0;

  for (const marker of markers) {
    colorCounts[marker.color] += 1;
    if (marker.planX < 0 || marker.planX > 1 || marker.planY < 0 || marker.planY > 1) {
      outOfRangePlanCoordinateCount += 1;
    }
  }

  return {
    markerCount: markers.length,
    colorCounts,
    outOfRangePlanCoordinateCount,
    isValid:
      markers.length === 12 &&
      AAG_MARKER_COLORS.every((color) => colorCounts[color] === 3) &&
      outOfRangePlanCoordinateCount === 0,
  };
}

export function createAagAnswerSetCsv(
  floorPlanId: AagFloorPlanId,
  setId: AagSetId,
  markers: AagAnswerMarkerInput[],
): string {
  const validation = validateAagAnswerSet(markers);
  if (!validation.isValid) {
    throw new Error("Only a complete, valid AAG answer set can be exported.");
  }

  const header = [
    "floor_plan_id",
    "set_id",
    "answer_marker_id",
    "color",
    "world_x",
    "world_y",
    "world_z",
    "plan_x",
    "plan_y",
    "label",
  ];
  const rows = markers
    .slice()
    .sort((left, right) => left.color.localeCompare(right.color) || left.label.localeCompare(right.label))
    .map((marker) => [
      floorPlanId,
      setId,
      marker.answerMarkerId,
      marker.color,
      marker.worldX,
      marker.worldY,
      marker.worldZ,
      marker.planX,
      marker.planY,
      marker.label,
    ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvField(String(value))).join(","))
    .join("\r\n");
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
