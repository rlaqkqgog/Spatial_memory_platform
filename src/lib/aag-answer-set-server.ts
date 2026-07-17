import "server-only";

import {
  type AagAnswerMarkerInput,
  type AagAnswerSetStatus,
  type AagFloorPlanId,
  type AagSetId,
  createAagAnswerSetCsv,
  validateAagAnswerSet,
} from "@/lib/aag-answer-set";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

interface AagAnswerSetRow {
  floor_plan_id: AagFloorPlanId;
  set_id: AagSetId;
  status: AagAnswerSetStatus;
  seed: string | null;
  generator_version: string | null;
  authoring_settings: Record<string, unknown>;
  updated_at: string;
}

interface AagAnswerMarkerRow {
  answer_marker_id: string;
  floor_plan_id: AagFloorPlanId;
  set_id: AagSetId;
  color: AagAnswerMarkerInput["color"];
  label: string;
  world_x: number;
  world_y: number;
  world_z: number;
  plan_x: number;
  plan_y: number;
}

export interface AagAnswerSetDetail {
  floorPlanId: AagFloorPlanId;
  setId: AagSetId;
  status: AagAnswerSetStatus;
  seed: string | null;
  generatorVersion: string | null;
  authoringSettings: Record<string, unknown>;
  updatedAt: string;
  markers: AagAnswerMarkerInput[];
  validation: ReturnType<typeof validateAagAnswerSet>;
}

export async function listAagAnswerSets(): Promise<AagAnswerSetDetail[]> {
  const supabase = createSupabaseAdminClient();
  const [{ data: setRows, error: setError }, { data: markerRows, error: markerError }] = await Promise.all([
    supabase
      .from("aag_answer_sets")
      .select("floor_plan_id, set_id, status, seed, generator_version, authoring_settings, updated_at")
      .order("floor_plan_id")
      .order("set_id"),
    supabase
      .from("aag_answer_markers")
      .select("answer_marker_id, floor_plan_id, set_id, color, label, world_x, world_y, world_z, plan_x, plan_y")
      .order("color")
      .order("label"),
  ]);

  if (setError) throw new Error("Unable to load AAG answer sets.", { cause: setError });
  if (markerError) throw new Error("Unable to load AAG answer markers.", { cause: markerError });

  return ((setRows ?? []) as AagAnswerSetRow[]).map((setRow) => toDetail(
    setRow,
    ((markerRows ?? []) as AagAnswerMarkerRow[]).filter(
      (marker) => marker.floor_plan_id === setRow.floor_plan_id && marker.set_id === setRow.set_id,
    ),
  ));
}

export async function getAagAnswerSet(
  floorPlanId: AagFloorPlanId,
  setId: AagSetId,
): Promise<AagAnswerSetDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data: setRow, error: setError } = await supabase
    .from("aag_answer_sets")
    .select("floor_plan_id, set_id, status, seed, generator_version, authoring_settings, updated_at")
    .eq("floor_plan_id", floorPlanId)
    .eq("set_id", setId)
    .maybeSingle();

  if (setError) throw new Error("Unable to load the AAG answer set.", { cause: setError });
  if (!setRow) return null;

  const { data: markerRows, error: markerError } = await supabase
    .from("aag_answer_markers")
    .select("answer_marker_id, floor_plan_id, set_id, color, label, world_x, world_y, world_z, plan_x, plan_y")
    .eq("floor_plan_id", floorPlanId)
    .eq("set_id", setId)
    .order("color")
    .order("label");

  if (markerError) throw new Error("Unable to load AAG answer markers.", { cause: markerError });
  return toDetail(setRow as AagAnswerSetRow, (markerRows ?? []) as AagAnswerMarkerRow[]);
}

export async function replaceAagAnswerMarkers(
  floorPlanId: AagFloorPlanId,
  setId: AagSetId,
  markers: AagAnswerMarkerInput[],
  seed: string | null,
  generatorVersion: string | null,
): Promise<AagAnswerSetDetail> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("aag_replace_answer_markers", {
    p_floor_plan_id: floorPlanId,
    p_set_id: setId,
    p_markers: markers.map((marker) => ({
      answer_marker_id: marker.answerMarkerId,
      color: marker.color,
      label: marker.label,
      world_x: marker.worldX,
      world_y: marker.worldY,
      world_z: marker.worldZ,
      plan_x: marker.planX,
      plan_y: marker.planY,
    })),
    p_seed: seed,
    p_generator_version: generatorVersion,
  });
  if (error) throw new Error(error.message, { cause: error });

  const saved = await getAagAnswerSet(floorPlanId, setId);
  if (!saved) throw new Error("AAG answer set disappeared after saving.");
  return saved;
}

export async function setAagAnswerSetStatus(
  floorPlanId: AagFloorPlanId,
  setId: AagSetId,
  status: AagAnswerSetStatus,
): Promise<AagAnswerSetDetail> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("aag_set_answer_set_status", {
    p_floor_plan_id: floorPlanId,
    p_set_id: setId,
    p_status: status,
  });
  if (error) throw new Error(error.message, { cause: error });

  const saved = await getAagAnswerSet(floorPlanId, setId);
  if (!saved) throw new Error("AAG answer set disappeared after updating its status.");
  return saved;
}

export async function exportAagAnswerSetCsv(
  floorPlanId: AagFloorPlanId,
  setId: AagSetId,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("aag_export_answer_set", {
    p_floor_plan_id: floorPlanId,
    p_set_id: setId,
  });
  if (error) throw new Error(error.message, { cause: error });

  const markers = ((data ?? []) as AagAnswerMarkerRow[]).map(toMarkerInput);
  return createAagAnswerSetCsv(floorPlanId, setId, markers);
}

function toDetail(setRow: AagAnswerSetRow, markerRows: AagAnswerMarkerRow[]): AagAnswerSetDetail {
  const markers = markerRows.map(toMarkerInput);
  return {
    floorPlanId: setRow.floor_plan_id,
    setId: setRow.set_id,
    status: setRow.status,
    seed: setRow.seed,
    generatorVersion: setRow.generator_version,
    authoringSettings: setRow.authoring_settings,
    updatedAt: setRow.updated_at,
    markers,
    validation: validateAagAnswerSet(markers),
  };
}

function toMarkerInput(marker: AagAnswerMarkerRow): AagAnswerMarkerInput {
  return {
    answerMarkerId: marker.answer_marker_id,
    color: marker.color,
    label: marker.label,
    worldX: marker.world_x,
    worldY: marker.world_y,
    worldZ: marker.world_z,
    planX: marker.plan_x,
    planY: marker.plan_y,
  };
}
