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
