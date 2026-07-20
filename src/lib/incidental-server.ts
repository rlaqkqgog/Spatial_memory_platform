import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { GUIDE_TYPES, INCIDENTAL_OBJECT_SETS, type GuideType } from "@/types/experiment";

/** object_id → 사람이 읽는 라벨(냄비, 삽 등). 세션마다 같은 라벨을 쓰므로 전 세션을 평탄화합니다. */
const LABEL_BY_OBJECT_ID = new Map<string, string>();
for (const objectSet of Object.values(INCIDENTAL_OBJECT_SETS)) {
  for (const objectDef of objectSet) {
    LABEL_BY_OBJECT_ID.set(objectDef.id, objectDef.label);
  }
}

function guideTypeOrNull(value: unknown): GuideType | null {
  return typeof value === "string" && (GUIDE_TYPES as readonly string[]).includes(value) ? (value as GuideType) : null;
}

export interface IncidentalResponseRow {
  /** 응답 행 id — 수동 채점 저장 시 사용합니다. */
  id: string;
  display_order: number;
  object_id: string;
  label: string;
  /** 참가자가 "봤음"이라고 답했는지 */
  seen: boolean;
  /** 실제로 그 세션에 배치되었던 객체인지(정답) */
  was_present: boolean;
  /** 자동 채점 결과: seen === was_present */
  auto_correct: boolean;
  /** 관리자가 수동으로 지정한 정답 여부. null이면 자동 채점을 사용합니다. */
  manual_correct: boolean | null;
  /** 실제 적용되는 정답 여부: manual_correct ?? auto_correct */
  correct: boolean;
  change_count: number;
  answered_at: string;
}

export interface IncidentalSubmissionSummary {
  id: string;
  participant_id: string;
  experiment_code: string;
  guide_type: GuideType | null;
  main_submission_id: string | null;
  started_at: string;
  submitted_at: string;
  duration_ms: number;
  responses: IncidentalResponseRow[];
  totalCount: number;
  correctCount: number;
  /** 정답 비율(0~1) */
  accuracy: number;
  /** 실제 배치 객체를 "봤음"이라 맞춘 수 */
  hitCount: number;
  presentCount: number;
  /** 미출현 객체를 "봤음"이라 잘못 답한 수 */
  falseAlarmCount: number;
  absentCount: number;
}

interface RawResponse {
  id: string;
  display_order: number;
  object_id: string;
  seen: boolean;
  was_present: boolean;
  manual_correct: boolean | null;
  answered_at: string;
  change_count: number;
}

function toResponseRow(raw: RawResponse): IncidentalResponseRow {
  const autoCorrect = raw.seen === raw.was_present;
  const manualCorrect = typeof raw.manual_correct === "boolean" ? raw.manual_correct : null;
  return {
    id: raw.id,
    display_order: raw.display_order,
    object_id: raw.object_id,
    label: LABEL_BY_OBJECT_ID.get(raw.object_id) ?? raw.object_id,
    seen: raw.seen,
    was_present: raw.was_present,
    auto_correct: autoCorrect,
    manual_correct: manualCorrect,
    correct: manualCorrect ?? autoCorrect,
    change_count: raw.change_count,
    answered_at: raw.answered_at,
  };
}

function summarize(responses: IncidentalResponseRow[]) {
  let correctCount = 0;
  let hitCount = 0;
  let presentCount = 0;
  let falseAlarmCount = 0;
  let absentCount = 0;
  for (const response of responses) {
    if (response.correct) {
      correctCount += 1;
    }
    if (response.was_present) {
      presentCount += 1;
      if (response.seen) {
        hitCount += 1;
      }
    } else {
      absentCount += 1;
      if (response.seen) {
        falseAlarmCount += 1;
      }
    }
  }
  const totalCount = responses.length;
  return {
    totalCount,
    correctCount,
    accuracy: totalCount > 0 ? correctCount / totalCount : 0,
    hitCount,
    presentCount,
    falseAlarmCount,
    absentCount,
  };
}

/** 우연객체 재인 응답을 제출별로(최신순) 불러옵니다. 각 응답은 display_order 순으로 정렬됩니다. */
export async function listIncidentalRecognitions(): Promise<IncidentalSubmissionSummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("incidental_recognition_submissions")
    .select(
      "id, participant_id, experiment_code, guide_type, main_submission_id, started_at, submitted_at, duration_ms, incidental_recognition_responses(id, display_order, object_id, seen, was_present, manual_correct, answered_at, change_count)",
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const rawResponses = ((row as { incidental_recognition_responses?: RawResponse[] }).incidental_recognition_responses ??
      []) as RawResponse[];
    const responses = rawResponses
      .map(toResponseRow)
      .sort((a, b) => a.display_order - b.display_order);
    return {
      id: row.id as string,
      participant_id: row.participant_id as string,
      experiment_code: row.experiment_code as string,
      guide_type: guideTypeOrNull(row.guide_type),
      main_submission_id: (row.main_submission_id as string | null) ?? null,
      started_at: row.started_at as string,
      submitted_at: row.submitted_at as string,
      duration_ms: row.duration_ms as number,
      responses,
      ...summarize(responses),
    };
  });
}

function csvField(value: string | number | boolean): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const INCIDENTAL_CSV_HEADER = [
  "participantId",
  "experimentCode",
  "guideType",
  "objectId",
  "label",
  "displayOrder",
  "wasPresent",
  "seen",
  "correct",
  "autoCorrect",
  "manualOverride",
  "changeCount",
  "answeredAt",
  "startedAt",
  "submittedAt",
  "durationMs",
  "mainSubmissionId",
] as const;

/** 우연객체 재인 응답 전체를 응답 1건당 한 행으로 CSV로 만듭니다.(참가자·제출·표시순 정렬) */
export async function buildIncidentalCsv(): Promise<string | null> {
  const submissions = await listIncidentalRecognitions();
  if (submissions.length === 0) {
    return null;
  }

  const ordered = [...submissions].sort(
    (a, b) =>
      a.participant_id.localeCompare(b.participant_id) ||
      a.experiment_code.localeCompare(b.experiment_code) ||
      a.submitted_at.localeCompare(b.submitted_at),
  );

  const lines: string[] = [INCIDENTAL_CSV_HEADER.map((field) => csvField(field)).join(",")];
  for (const submission of ordered) {
    for (const response of submission.responses) {
      lines.push(
        [
          submission.participant_id,
          submission.experiment_code,
          submission.guide_type ?? "NA",
          response.object_id,
          response.label,
          response.display_order,
          response.was_present,
          response.seen,
          response.correct,
          response.auto_correct,
          response.manual_correct === null ? "" : response.manual_correct,
          response.change_count,
          response.answered_at,
          submission.started_at,
          submission.submitted_at,
          submission.duration_ms,
          submission.main_submission_id ?? "",
        ]
          .map((field) => csvField(field))
          .join(","),
      );
    }
  }

  return `${lines.join("\r\n")}\r\n`;
}

/**
 * 응답 하나의 정답/오답을 수동으로 덮어씁니다.
 * manualCorrect가 null이면 자동 채점(seen === was_present)으로 되돌립니다.
 */
export async function setIncidentalManualGrade(responseId: string, manualCorrect: boolean | null): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("incidental_recognition_responses")
    .update({
      manual_correct: manualCorrect,
      manual_graded_at: manualCorrect === null ? null : new Date().toISOString(),
    })
    .eq("id", responseId);

  if (error) {
    throw new Error(error.message);
  }
}
