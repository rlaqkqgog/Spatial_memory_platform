import { NextResponse } from "next/server";

import { createSupabaseAdminClient, getSupabaseAdminConfig } from "@/lib/supabase-admin";
import {
  FLOOR_PLANS,
  GUIDE_TYPES,
  INCIDENTAL_OBJECT_SETS,
  SESSION_NUMBERS,
  buildExperimentCode,
  type IncidentalObjectDef,
  type IncidentalRecognitionSubmission,
  type SessionNumber,
} from "@/types/experiment";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isGuideType(value: unknown): value is (typeof GUIDE_TYPES)[number] {
  return typeof value === "string" && GUIDE_TYPES.includes(value as (typeof GUIDE_TYPES)[number]);
}

/** experimentCode(예: "FP1-S1")에서 세션의 우연객체 목록을 찾습니다. */
function findObjectSet(experimentCode: string): IncidentalObjectDef[] | null {
  for (const floorPlan of FLOOR_PLANS) {
    for (const sessionNumber of SESSION_NUMBERS) {
      if (buildExperimentCode(floorPlan, sessionNumber) === experimentCode) {
        return INCIDENTAL_OBJECT_SETS[sessionNumber as SessionNumber];
      }
    }
  }
  return null;
}

/** 외부 입력을 API 경계에서 검증해 데이터베이스 제약 조건에만 의존하지 않습니다. */
function isValidSubmission(value: unknown): value is IncidentalRecognitionSubmission {
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
    !Array.isArray(value.responses)
  ) {
    return false;
  }

  const objectDefs = findObjectSet(value.experimentCode);
  if (!objectDefs || value.responses.length !== objectDefs.length) {
    return false;
  }
  const validObjectIds = new Set(objectDefs.map((objectDef) => objectDef.id));

  const answeredObjectIds = new Set<string>();
  const responsesAreValid = value.responses.every((response) => {
    if (!isRecord(response)) {
      return false;
    }

    if (
      typeof response.objectId !== "string" ||
      !validObjectIds.has(response.objectId) ||
      answeredObjectIds.has(response.objectId)
    ) {
      return false;
    }
    answeredObjectIds.add(response.objectId);

    return (
      typeof response.seen === "boolean" &&
      isValidDate(response.answeredAt) &&
      typeof response.changeCount === "number" &&
      Number.isInteger(response.changeCount) &&
      response.changeCount >= 0
    );
  });

  // 모든 객체에 정확히 하나씩 응답이 있어야 합니다.
  return responsesAreValid && answeredObjectIds.size === objectDefs.length;
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

  const objectDefs = findObjectSet(body.experimentCode);
  const wasPresentById = new Map((objectDefs ?? []).map((objectDef) => [objectDef.id, objectDef.wasPresent]));
  const displayOrderById = new Map((objectDefs ?? []).map((objectDef, index) => [objectDef.id, index + 1]));

  const supabase = createSupabaseAdminClient();
  const responseRows = body.responses.map((response) => ({
    display_order: displayOrderById.get(response.objectId),
    object_id: response.objectId,
    seen: response.seen,
    was_present: wasPresentById.get(response.objectId) ?? false,
    answered_at: response.answeredAt,
    change_count: response.changeCount,
  }));

  const { data: submissionId, error } = await supabase.rpc("record_incidental_recognition", {
    p_experiment_code: body.experimentCode.trim(),
    p_participant_id: body.participantId.trim(),
    p_guide_type: body.guideType,
    p_main_submission_id: body.mainSubmissionId,
    p_started_at: body.startedAt,
    p_submitted_at: body.submittedAt,
    p_duration_ms: Math.round(submittedAtMs - startedAtMs),
    p_responses: responseRows,
  });

  if (error || !submissionId) {
    console.error("Failed to store incidental recognition submission", error);
    return NextResponse.json({ message: "응답 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ submissionId });
}
