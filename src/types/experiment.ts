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
  /**
   * 실제 배치된 객체는 Unity 기기 스냅샷(fp*_incidental_anchor_sets.json)의 object_id와 동일한 값이고,
   * 배치되지 않은(미출현) 객체는 incidental_extra_* 형식입니다.
   */
  id: string;
  label: string;
  /** 해당 세션에서 실제로 공간에 배치되었던 객체인지(재인 검사의 정답) 여부입니다. */
  wasPresent: boolean;
}

/**
 * 세션별 우연객체(incidental object) 재인 검사 목록입니다. 세션마다 실제 배치 5개 + 미출현 5개, 총 10개입니다.
 * 목록 순서는 화면 표시 순서와 동일합니다. FP1·FP2가 같은 세션 목록을 공유합니다.
 */
export const INCIDENTAL_OBJECT_SETS: Record<SessionNumber, IncidentalObjectDef[]> = {
  S1: [
    { id: "incidental_04_04_pot", label: "냄비", wasPresent: true },
    { id: "incidental_extra_fryingPan", label: "프라이팬", wasPresent: false },
    { id: "incidental_extra_shovel", label: "삽", wasPresent: false },
    { id: "incidental_extra_radio", label: "라디오", wasPresent: false },
    { id: "incidental_extra_candle", label: "양초", wasPresent: false },
    { id: "incidental_extra_ukulele", label: "우쿨렐레", wasPresent: false },
    { id: "incidental_03_03_iron", label: "다리미", wasPresent: true },
    { id: "incidental_02_02_bowlingBall", label: "볼링공", wasPresent: true },
    { id: "incidental_05_05_watering_can", label: "물뿌리개", wasPresent: true },
    { id: "incidental_01_01_birdcage_open", label: "새장", wasPresent: true },
  ],
  S2: [
    { id: "incidental_extra_telephone", label: "전화기", wasPresent: false },
    { id: "incidental_extra_balanceScale", label: "양팔저울", wasPresent: false },
    { id: "incidental_01_01_drill", label: "전동드릴", wasPresent: true },
    { id: "incidental_05_05_sewingMachin", label: "재봉틀", wasPresent: true },
    { id: "incidental_04_04_lantern", label: "랜턴", wasPresent: true },
    { id: "incidental_extra_safetyHelmet", label: "안전모", wasPresent: false },
    { id: "incidental_03_03_kettle", label: "주전자", wasPresent: true },
    { id: "incidental_extra_sickle", label: "낫", wasPresent: false },
    { id: "incidental_02_02_jar", label: "항아리", wasPresent: true },
    { id: "incidental_extra_toaster", label: "토스터기", wasPresent: false },
  ],
  S3: [
    { id: "incidental_extra_turntable", label: "턴테이블", wasPresent: false },
    { id: "incidental_extra_telescope", label: "망원경", wasPresent: false },
    { id: "incidental_extra_blender", label: "믹서기", wasPresent: false },
    { id: "incidental_05_05_sandClock", label: "모래시계", wasPresent: true },
    { id: "incidental_02_02_hairDryer", label: "헤어드라이기", wasPresent: true },
    { id: "incidental_04_04_riceCooker", label: "전기밥솥", wasPresent: true },
    { id: "incidental_extra_paintRoller", label: "페인트 롤러", wasPresent: false },
    { id: "incidental_03_03_heamer", label: "망치", wasPresent: true },
    { id: "incidental_extra_trophy", label: "트로피", wasPresent: false },
    { id: "incidental_01_01_Globe", label: "지구본", wasPresent: true },
  ],
};

export function getIncidentalObjects(sessionNumber: SessionNumber): IncidentalObjectDef[] {
  return INCIDENTAL_OBJECT_SETS[sessionNumber] ?? [];
}

/** 우연객체 하나에 대한 봤음/못 봤음 응답입니다. */
export interface IncidentalRecognitionResponse {
  objectId: string;
  /** 참가자가 "봤음"을 선택했으면 true입니다. */
  seen: boolean;
  /** 마지막으로 답을 선택(또는 변경)한 시각입니다. */
  answeredAt: string;
  /** 답을 바꾼 횟수입니다. 처음 선택은 0입니다. */
  changeCount: number;
}

/** 본 응답 제출 후 이어지는 우연객체 재인 검사 응답입니다. */
export interface IncidentalRecognitionSubmission {
  experimentCode: string;
  participantId: string;
  guideType: GuideType;
  /** 같은 참가자·세션의 본 응답 저장 번호입니다. */
  mainSubmissionId: string;
  startedAt: string;
  submittedAt: string;
  responses: IncidentalRecognitionResponse[];
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
