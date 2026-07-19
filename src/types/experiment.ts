/** 색상별로 3개씩, 총 12개의 마커를 입력하는 실험의 기본 설정입니다. */
export const MARKER_COLORS = ["red", "blue", "green", "yellow"] as const;

export type MarkerColor = (typeof MARKER_COLORS)[number];

export const MAX_MARKERS_PER_COLOR = 3;
export const TOTAL_MARKERS = MARKER_COLORS.length * MAX_MARKERS_PER_COLOR;
/** 현재 연구 조건의 식별자입니다. 이후 관리자 기능에서 실험 조건별 값으로 교체합니다. */
export const DEFAULT_EXPERIMENT_CODE = "default";

export const GUIDE_TYPES = ["VG", "AAG", "NG"] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

export const GUIDE_TYPE_LABELS: Record<GuideType, string> = {
  VG: "시각 가이드(VG)",
  AAG: "음성 가이드(AAG)",
  NG: "가이드 없음(NG)",
};

export const SESSION_NUMBERS = ["S1", "S2", "S3"] as const;
export type SessionNumber = (typeof SESSION_NUMBERS)[number];

export const SESSION_NUMBER_LABELS: Record<SessionNumber, string> = {
  S1: "세션 1 (S1)",
  S2: "세션 2 (S2)",
  S3: "세션 3 (S3)",
};

export const FLOOR_PLANS = ["FP1", "FP2"] as const;
export type FloorPlan = (typeof FLOOR_PLANS)[number];

export const FLOOR_PLAN_LABELS: Record<FloorPlan, string> = {
  FP1: "평면도 1 (FP1)",
  FP2: "평면도 2 (FP2)",
};

/** public 폴더의 평면도 이미지 경로입니다. 실제 도면 SVG로 교체해 사용합니다. */
export const FLOOR_PLAN_IMAGES: Record<FloorPlan, string> = {
  FP1: "/floor-plan-fp1.svg",
  FP2: "/floor-plan-fp2.svg",
};

/** 평면도·세션 조합을 experimentCode(예: "FP1-S1")로 인코딩합니다. */
export function buildExperimentCode(floorPlan: FloorPlan, sessionNumber: SessionNumber): string {
  return `${floorPlan}-${sessionNumber}`;
}

export interface IncidentalObjectDef {
  /** Unity 기기 스냅샷(fp*_incidental_anchor_sets.json)의 object_id와 동일한 값입니다. */
  id: string;
  label: string;
}

/**
 * 세션별 우연객체(incidental object) 목록입니다.
 * FP2 세트는 아직 authoring 전이므로 자리표시자입니다. 확정되면 실제 object_id·이름으로 교체하세요.
 */
export const INCIDENTAL_OBJECT_SETS: Record<string, IncidentalObjectDef[]> = {
  "FP1-S1": [
    { id: "incidental_01_01_birdcage_open", label: "새장 (Birdcage)" },
    { id: "incidental_02_02_bowlingBall", label: "볼링공 (Bowling ball)" },
    { id: "incidental_03_03_iron", label: "다리미 (Iron)" },
    { id: "incidental_04_04_pot", label: "냄비 (Pot)" },
    { id: "incidental_05_05_watering_can", label: "물뿌리개 (Watering can)" },
  ],
  "FP1-S2": [
    { id: "incidental_01_01_drill", label: "드릴 (Drill)" },
    { id: "incidental_02_02_jar", label: "유리병 (Jar)" },
    { id: "incidental_03_03_kettle", label: "주전자 (Kettle)" },
    { id: "incidental_04_04_lantern", label: "랜턴 (Lantern)" },
    { id: "incidental_05_05_sewingMachin", label: "재봉틀 (Sewing machine)" },
  ],
  "FP1-S3": [
    { id: "incidental_01_01_Globe", label: "지구본 (Globe)" },
    { id: "incidental_02_02_hairDryer", label: "헤어드라이어 (Hair dryer)" },
    { id: "incidental_03_03_heamer", label: "망치 (Hammer)" },
    { id: "incidental_04_04_riceCooker", label: "밥솥 (Rice cooker)" },
    { id: "incidental_05_05_sandClock", label: "모래시계 (Sand clock)" },
  ],
  "FP2-S1": [
    { id: "fp2_s1_incidental_01", label: "우연객체 1" },
    { id: "fp2_s1_incidental_02", label: "우연객체 2" },
    { id: "fp2_s1_incidental_03", label: "우연객체 3" },
    { id: "fp2_s1_incidental_04", label: "우연객체 4" },
    { id: "fp2_s1_incidental_05", label: "우연객체 5" },
  ],
  "FP2-S2": [
    { id: "fp2_s2_incidental_01", label: "우연객체 1" },
    { id: "fp2_s2_incidental_02", label: "우연객체 2" },
    { id: "fp2_s2_incidental_03", label: "우연객체 3" },
    { id: "fp2_s2_incidental_04", label: "우연객체 4" },
    { id: "fp2_s2_incidental_05", label: "우연객체 5" },
  ],
  "FP2-S3": [
    { id: "fp2_s3_incidental_01", label: "우연객체 1" },
    { id: "fp2_s3_incidental_02", label: "우연객체 2" },
    { id: "fp2_s3_incidental_03", label: "우연객체 3" },
    { id: "fp2_s3_incidental_04", label: "우연객체 4" },
    { id: "fp2_s3_incidental_05", label: "우연객체 5" },
  ],
};

export function getIncidentalObjects(floorPlan: FloorPlan, sessionNumber: SessionNumber): IncidentalObjectDef[] {
  return INCIDENTAL_OBJECT_SETS[buildExperimentCode(floorPlan, sessionNumber)] ?? [];
}

export interface IncidentalMarker {
  id: string;
  objectId: string;
  /** 평면도 기준 정규화 좌표(0~1)입니다. */
  x: number;
  y: number;
  placedAt: string;
  moveCount: number;
}

export type IncidentalEventType =
  | "start"
  | "object_select"
  | "marker_place"
  | "marker_move"
  | "marker_delete"
  | "submit";

export interface IncidentalEvent {
  type: IncidentalEventType;
  occurredAt: string;
  markerId?: string;
  objectId?: string;
  x?: number;
  y?: number;
}

/** 본 응답 제출 후 이어지는 우연객체 위치 응답입니다. */
export interface IncidentalSubmission {
  experimentCode: string;
  participantId: string;
  guideType: GuideType;
  /** 같은 참가자·세션의 본 응답 저장 번호입니다. */
  mainSubmissionId: string;
  startedAt: string;
  submittedAt: string;
  deletedMarkerCount: number;
  markers: IncidentalMarker[];
  events: IncidentalEvent[];
}

export interface Marker {
  /** 브라우저에서 생성한 식별자입니다. 재시도 시 중복 저장을 막는 데도 사용합니다. */
  id: string;
  color: MarkerColor;
  /** 평면도 너비를 기준으로 정규화한 좌표(0~1)입니다. */
  x: number;
  /** 평면도 높이를 기준으로 정규화한 좌표(0~1)입니다. */
  y: number;
  placedAt: string;
  moveCount: number;
}

export type ExperimentEventType =
  | "start"
  | "color_select"
  | "marker_place"
  | "marker_move"
  | "marker_delete"
  | "submit";

export interface ExperimentEvent {
  type: ExperimentEventType;
  occurredAt: string;
  markerId?: string;
  color?: MarkerColor;
  x?: number;
  y?: number;
}

/** 서버 API로 전송하는, 제출이 완료된 한 번의 실험 응답입니다. */
export interface ExperimentSubmission {
  experimentCode: string;
  participantId: string;
  guideType: GuideType;
  startedAt: string;
  submittedAt: string;
  deletedMarkerCount: number;
  markers: Marker[];
  events: ExperimentEvent[];
}
