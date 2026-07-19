import { NextResponse } from "next/server";

import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";
import {
  GUIDE_TYPES,
  INCIDENTAL_OBJECT_SETS,
  type IncidentalEventType,
  type IncidentalSubmission,
} from "@/types/experiment";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set<IncidentalEventType>([
  "start",
  "object_select",
  "marker_place",
  "marker_move",
  "marker_delete",
  "submit",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNormalizedCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isGuideType(value: unknown): value is (typeof GUIDE_TYPES)[number] {
  return typeof value === "string" && GUIDE_TYPES.includes(value as (typeof GUIDE_TYPES)[number]);
}

function hasValidOptionalMarkerDetails(event: UnknownRecord, validObjectIds: Set<string>): boolean {
  const hasMarkerId = event.markerId !== undefined;
  const hasObjectId = event.objectId !== undefined;
  const hasX = event.x !== undefined;
  const hasY = event.y !== undefined;

  if (hasMarkerId && (typeof event.markerId !== "string" || !UUID_PATTERN.test(event.markerId))) {
    return false;
  }
  if (hasObjectId && (typeof event.objectId !== "string" || !validObjectIds.has(event.objectId))) {
    return false;
  }
  if (hasX !== hasY || (hasX && (!isNormalizedCoordinate(event.x) || !isNormalizedCoordinate(event.y)))) {
    return false;
  }

  switch (event.type) {
    case "object_select":
      return hasObjectId;
    case "marker_place":
    case "marker_move":
    case "marker_delete":
      return hasMarkerId && hasObjectId && hasX;
    default:
      return !hasMarkerId && !hasObjectId && !hasX;
  }
}

/** 외부 입력을 API 경계에서 검증해 데이터베이스 제약 조건에만 의존하지 않습니다. */
function isValidSubmission(value: unknown): value is IncidentalSubmission {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.experimentCode !== "string" ||
    typeof value.participantId !== "string" ||
    value.participantId.trim().length < 2 ||
    value.participantId.length > 100 ||
    !isGuideType(value.guideType) ||
    typeof value.mainSubmissionId !== "string" ||
    !UUID_PATTERN.test(value.mainSubmissionId) ||
    !isValidDate(value.startedAt) ||
    !isValidDate(value.submittedAt) ||
    typeof value.deletedMarkerCount !== "number" ||
    !Number.isInteger(value.deletedMarkerCount) ||
    value.deletedMarkerCount < 0 ||
    !Array.isArray(value.markers) ||
    !Array.isArray(value.events) ||
    value.events.length === 0
  ) {
    return false;
  }

  const objectDefs = INCIDENTAL_OBJECT_SETS[value.experimentCode];
  if (!objectDefs || value.markers.length !== objectDefs.length) {
    return false;
  }
  const validObjectIds = new Set(objectDefs.map((objectDef) => objectDef.id));

  const markerIds = new Set<string>();
  const markerObjectIds = new Set<string>();
  const markersAreValid = value.markers.every((marker) => {
    if (!isRecord(marker)) {
      return false;
    }

    if (typeof marker.id !== "string" || !UUID_PATTERN.test(marker.id) || markerIds.has(marker.id)) {
      return false;
    }
    markerIds.add(marker.id);

    if (typeof marker.objectId !== "string" || !validObjectIds.has(marker.objectId) || markerObjectIds.has(marker.objectId)) {
      return false;
    }
    markerObjectIds.add(marker.objectId);

    return (
      isNormalizedCoordinate(marker.x) &&
      isNormalizedCoordinate(marker.y) &&
      isValidDate(marker.placedAt) &&
      typeof marker.moveCount === "number" &&
      Number.isInteger(marker.moveCount) &&
      marker.moveCount >= 0
    );
  });

  const eventsAreValid = value.events.every(
    (event) =>
      isRecord(event) &&
      typeof event.type === "string" &&
      EVENT_TYPES.has(event.type as IncidentalEventType) &&
      isValidDate(event.occurredAt) &&
      hasValidOptionalMarkerDetails(event, validObjectIds),
  );

  // 모든 우연객체에 정확히 하나씩 마커가 있어야 합니다.
  const hasAllObjects = markerObjectIds.size === objectDefs.length;

  return markersAreValid && eventsAreValid && hasAllObjects;
}

export async function POST(request: Request) {
  if (!getSupabaseAdminConfig()) {
    return NextResponse.json(
      { message: "Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해 주세요." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "JSON 형식의 요청 본문이 필요합니다." }, { status: 400 });
  }

  if (!isValidSubmission(body)) {
    return NextResponse.json({ message: "제출 데이터 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const startedAtMs = Date.parse(body.startedAt);
  const submittedAtMs = Date.parse(body.submittedAt);
  if (submittedAtMs < startedAtMs) {
    return NextResponse.json({ message: "제출 시간이 시작 시간보다 빠를 수 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const markerRows = body.markers.map((marker) => ({
    marker_client_id: marker.id,
    object_id: marker.objectId,
    x: marker.x,
    y: marker.y,
    placed_at: marker.placedAt,
    move_count: marker.moveCount,
  }));
  const eventRows = body.events.map((event, index) => ({
    event_sequence: index + 1,
    event_type: event.type,
    marker_client_id: event.markerId ?? null,
    object_id: event.objectId ?? null,
    x: event.x ?? null,
    y: event.y ?? null,
    occurred_at: event.occurredAt,
  }));

  const { data: submissionId, error } = await supabase.rpc("record_incidental_submission", {
    p_experiment_code: body.experimentCode.trim(),
    p_participant_id: body.participantId.trim(),
    p_guide_type: body.guideType,
    p_main_submission_id: body.mainSubmissionId,
    p_started_at: body.startedAt,
    p_submitted_at: body.submittedAt,
    p_duration_ms: Math.round(submittedAtMs - startedAtMs),
    p_deleted_marker_count: body.deletedMarkerCount,
    p_markers: markerRows,
    p_events: eventRows,
  });

  if (error || !submissionId) {
    console.error("Failed to store incidental submission", error);
    return NextResponse.json({ message: "응답 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ submissionId });
}
