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
  display_order: number;
  object_id: string;
  label: string;
  /** 참가자가 "봤음"이라고 답했는지 */
  seen: boolean;
  /** 실제로 그 세션에 배치되었던 객체인지(정답) */
  was_present: boolean;
  /** seen === was_present 이면 정답 */
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
  display_order: number;
  object_id: string;
  seen: boolean;
  was_present: boolean;
  answered_at: string;
  change_count: number;
}

function toResponseRow(raw: RawResponse): IncidentalResponseRow {
  return {
    display_order: raw.display_order,
    object_id: raw.object_id,
    label: LABEL_BY_OBJECT_ID.get(raw.object_id) ?? raw.object_id,
    seen: raw.seen,
    was_present: raw.was_present,
    correct: raw.seen === raw.was_present,
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
      "id, participant_id, experiment_code, guide_type, main_submission_id, started_at, submitted_at, duration_ms, incidental_recognition_responses(display_order, object_id, seen, was_present, answered_at, change_count)",
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
