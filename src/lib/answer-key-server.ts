import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildSubmissionCsv,
  DEFAULT_THRESHOLD_METERS,
  fitPlanToWorld,
  scoreMarkers,
  type CalibrationPoint,
  type ParsedAnswerKey,
  type ScoringStone,
  type SubmissionCsvEntry,
} from "@/lib/answer-key";
import type { FloorPlan, GuideType, MarkerColor, SessionNumber } from "@/types/experiment";

export interface AnswerKeyStoneRow {
  color: MarkerColor;
  label: string;
  room_id: string | null;
  world_x: number;
  world_z: number;
}

export interface AnswerKeySummary {
  id: string;
  participant_id: string;
  floor_plan: FloorPlan;
  session_number: string;
  set_id: string;
  guide_mode: string | null;
  source_filename: string | null;
  created_at: string;
  stone_count: number;
  stones: AnswerKeyStoneRow[];
}

/** 정답 CSV를 저장(교체)합니다. */
export async function recordAnswerKey(parsed: ParsedAnswerKey, sourceFilename: string | null): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const stones = parsed.stones.map((stone) => ({
    color: stone.color,
    label: stone.label,
    world_x: stone.world_x,
    world_y: stone.world_y,
    world_z: stone.world_z,
    room_id: stone.room_id,
    source_mode: stone.source_mode,
  }));

  const { data, error } = await supabase.rpc("record_answer_key", {
    p_participant_id: parsed.participantId,
    p_floor_plan: parsed.floorPlan,
    p_session_number: parsed.sessionNumber,
    p_set_id: parsed.setId,
    p_guide_mode: parsed.guideMode,
    p_source_filename: sourceFilename,
    p_stones: stones,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "정답 세트를 저장하지 못했습니다.");
  }
  return data as string;
}

export async function listAnswerKeys(): Promise<AnswerKeySummary[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("answer_keys")
    .select(
      "id, participant_id, floor_plan, session_number, set_id, guide_mode, source_filename, created_at, answer_key_stones(color, label, room_id, world_x, world_z)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const rawStones = ((row as { answer_key_stones?: unknown[] }).answer_key_stones ?? []) as AnswerKeyStoneRow[];
    const stones = rawStones.map((stone) => ({
      color: stone.color,
      label: stone.label,
      room_id: stone.room_id,
      world_x: stone.world_x,
      world_z: stone.world_z,
    }));
    return {
      id: row.id as string,
      participant_id: row.participant_id as string,
      floor_plan: row.floor_plan as FloorPlan,
      session_number: row.session_number as string,
      set_id: row.set_id as string,
      guide_mode: (row.guide_mode as string | null) ?? null,
      source_filename: (row.source_filename as string | null) ?? null,
      created_at: row.created_at as string,
      stone_count: stones.length,
      stones,
    };
  });
}

export async function deleteAnswerKey(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("answer_keys").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCalibration(floorPlan: FloorPlan): Promise<CalibrationPoint[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("floor_plan_calibrations")
    .select("reference_points")
    .eq("floor_plan", floorPlan)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return ((data?.reference_points as CalibrationPoint[] | null) ?? []) as CalibrationPoint[];
}

export async function setCalibration(floorPlan: FloorPlan, referencePoints: CalibrationPoint[]): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("set_floor_plan_calibration", {
    p_floor_plan: floorPlan,
    p_reference_points: referencePoints,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export type ScoreStatus = "scored" | "no_session" | "no_answer_key" | "no_calibration";

export interface SubmissionScore {
  status: ScoreStatus;
  accuracy?: number;
  meanErrorMeters?: number;
  withinThreshold?: number;
  totalMarkers?: number;
  thresholdMeters?: number;
}

interface ScorableSubmission {
  id: string;
  participant_id: string;
  floor_plan: FloorPlan;
  session_number: SessionNumber | null;
}

/**
 * 제출별로 (참가자·평면도·세션)에 맞는 정답 세트와 평면도 캘리브레이션을 찾아 정답률·평균오차를 계산합니다.
 * 세션 미지정·정답 없음·캘리브레이션 없음이면 그 상태를 반환합니다.
 */
export async function scoreSubmissions(submissions: ScorableSubmission[]): Promise<Record<string, SubmissionScore>> {
  const result: Record<string, SubmissionScore> = {};
  if (submissions.length === 0) {
    return result;
  }

  const supabase = createSupabaseAdminClient();
  const submissionIds = submissions.map((submission) => submission.id);

  const [markersResponse, answerKeysResponse, calibrationsResponse] = await Promise.all([
    supabase.from("marker_responses").select("submission_id, color, x, y").in("submission_id", submissionIds),
    supabase
      .from("answer_keys")
      .select("participant_id, floor_plan, session_number, answer_key_stones(color, world_x, world_y, world_z)"),
    supabase.from("floor_plan_calibrations").select("floor_plan, reference_points"),
  ]);

  const markersBySubmission = new Map<string, { color: MarkerColor; x: number; y: number }[]>();
  for (const row of markersResponse.data ?? []) {
    const list = markersBySubmission.get(row.submission_id as string) ?? [];
    list.push({ color: row.color as MarkerColor, x: row.x as number, y: row.y as number });
    markersBySubmission.set(row.submission_id as string, list);
  }

  const stonesByKey = new Map<string, ScoringStone[]>();
  for (const row of answerKeysResponse.data ?? []) {
    const key = `${row.participant_id}|${row.floor_plan}|${row.session_number}`;
    const rawStones = ((row as { answer_key_stones?: unknown[] }).answer_key_stones ?? []) as {
      color: MarkerColor;
      world_x: number;
      world_z: number;
    }[];
    stonesByKey.set(
      key,
      rawStones.map((stone) => ({ color: stone.color, world_x: stone.world_x, world_z: stone.world_z })),
    );
  }

  const calibrationByPlan = new Map<string, CalibrationPoint[]>();
  for (const row of calibrationsResponse.data ?? []) {
    calibrationByPlan.set(row.floor_plan as string, (row.reference_points as CalibrationPoint[] | null) ?? []);
  }

  for (const submission of submissions) {
    if (!submission.session_number) {
      result[submission.id] = { status: "no_session" };
      continue;
    }

    const stones = stonesByKey.get(`${submission.participant_id}|${submission.floor_plan}|${submission.session_number}`);
    if (!stones || stones.length === 0) {
      result[submission.id] = { status: "no_answer_key" };
      continue;
    }

    const referencePoints = calibrationByPlan.get(submission.floor_plan) ?? [];
    const transform = fitPlanToWorld(referencePoints);
    if (!transform) {
      result[submission.id] = { status: "no_calibration" };
      continue;
    }

    const markers = markersBySubmission.get(submission.id) ?? [];
    const score = scoreMarkers(markers, stones, transform, DEFAULT_THRESHOLD_METERS);
    result[submission.id] = {
      status: "scored",
      accuracy: score.accuracy,
      meanErrorMeters: score.meanErrorMeters,
      withinThreshold: score.withinThreshold,
      totalMarkers: score.totalMarkers,
      thresholdMeters: score.thresholdMeters,
    };
  }

  return result;
}

interface SubmissionForCsv {
  id: string;
  participant_id: string;
  experiment_code: string;
  session_number: SessionNumber | null;
  guide_type: GuideType | "unspecified";
}

/**
 * 참가자 위치 응답을 정답 CSV와 같은 형식의 CSV 문자열로 만듭니다.
 * submissionId를 주면 그 한 건만, 없으면 전체(참가자·가이드·제출순)를 내보냅니다.
 * 파일명에 쓸 label도 함께 반환합니다.
 */
export async function buildSubmissionsCsv(submissionId?: string): Promise<{ csv: string; label: string } | null> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("experiment_submissions")
    .select("id, participant_id, experiment_code, session_number, guide_type")
    .order("participant_id", { ascending: true })
    .order("guide_type", { ascending: true })
    .order("submitted_at", { ascending: true });
  if (submissionId) {
    query = supabase
      .from("experiment_submissions")
      .select("id, participant_id, experiment_code, session_number, guide_type")
      .eq("id", submissionId);
  }

  const { data: submissionRows, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  const submissions = (submissionRows ?? []) as SubmissionForCsv[];
  if (submissions.length === 0) {
    return null;
  }

  const submissionIds = submissions.map((submission) => submission.id);
  const [markersResponse, calibrationsResponse] = await Promise.all([
    supabase.from("marker_responses").select("submission_id, color, x, y").in("submission_id", submissionIds),
    supabase.from("floor_plan_calibrations").select("floor_plan, reference_points"),
  ]);

  const markersBySubmission = new Map<string, { color: MarkerColor; x: number; y: number }[]>();
  for (const row of markersResponse.data ?? []) {
    const list = markersBySubmission.get(row.submission_id as string) ?? [];
    list.push({ color: row.color as MarkerColor, x: row.x as number, y: row.y as number });
    markersBySubmission.set(row.submission_id as string, list);
  }

  const transformByPlan = new Map<string, ReturnType<typeof fitPlanToWorld>>();
  for (const row of calibrationsResponse.data ?? []) {
    transformByPlan.set(
      row.floor_plan as string,
      fitPlanToWorld((row.reference_points as CalibrationPoint[] | null) ?? []),
    );
  }

  const entries: SubmissionCsvEntry[] = submissions.map((submission) => ({
    participantId: submission.participant_id,
    floorPlan: submission.experiment_code as FloorPlan,
    sessionNumber: submission.session_number,
    guideType: submission.guide_type === "unspecified" ? "NA" : submission.guide_type,
    markers: markersBySubmission.get(submission.id) ?? [],
    transform: transformByPlan.get(submission.experiment_code) ?? null,
  }));

  const csv = buildSubmissionCsv(entries);
  const label =
    submissionId && submissions.length === 1
      ? `${submissions[0].participant_id}_${submissions[0].experiment_code}-${submissions[0].session_number ?? "UNMATCHED"}_${entries[0].guideType}`
      : "all_submissions";

  return { csv, label };
}

/**
 * 첨부 파일 다운로드용 Content-Disposition 헤더 값을 만듭니다.
 * participant_id 등에 한글(비ASCII)이 섞여도 헤더 생성이 실패하지 않도록,
 * ASCII 대체 파일명과 RFC 5987 UTF-8 인코딩 파일명을 함께 넣습니다.
 */
export function attachmentContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
