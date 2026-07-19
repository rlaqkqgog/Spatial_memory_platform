import { FLOOR_PLANS, MARKER_COLORS, SESSION_NUMBERS, type FloorPlan, type MarkerColor, type SessionNumber } from "@/types/experiment";

/** 이 거리(미터) 이내면 정답으로 봅니다. 연구 설계에 맞춰 조정하세요. */
export const DEFAULT_THRESHOLD_METERS = 3;

export interface AnswerKeyStone {
  color: MarkerColor;
  label: string;
  world_x: number;
  world_y: number | null;
  world_z: number;
  room_id: string | null;
  source_mode: string | null;
}

export interface ParsedAnswerKey {
  participantId: string;
  floorPlan: FloorPlan;
  sessionNumber: SessionNumber;
  setId: string;
  guideMode: string | null;
  stones: AnswerKeyStone[];
}

/** 캘리브레이션 기준점: 평면도 정규화 좌표(0~1)와 그 지점의 월드 좌표(미터)를 짝지은 것입니다. */
export interface CalibrationPoint {
  plan_x: number;
  plan_y: number;
  world_x: number;
  world_z: number;
}

/** plan(px,py) → world(wx,wz) 아핀 변환 계수입니다. */
export interface PlanToWorldTransform {
  // wx = ax * px + bx * py + cx
  ax: number;
  bx: number;
  cx: number;
  // wz = az * px + bz * py + cz
  az: number;
  bz: number;
  cz: number;
}

const COLOR_ALIASES: Record<string, MarkerColor> = {
  red: "red",
  blue: "blue",
  green: "green",
  yellow: "yellow",
};

/** 따옴표를 존중하는 한 줄 CSV 파서입니다. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function toFiniteNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** setId "FP1-S3"에서 평면도와 세션을 분리합니다. */
export function splitSetId(setId: string): { floorPlan: FloorPlan; sessionNumber: SessionNumber } | null {
  const match = setId.trim().match(/^(FP[12])-(S[123])$/i);
  if (!match) {
    return null;
  }
  const floorPlan = match[1].toUpperCase();
  const sessionNumber = match[2].toUpperCase();
  if (!FLOOR_PLANS.includes(floorPlan as FloorPlan) || !SESSION_NUMBERS.includes(sessionNumber as SessionNumber)) {
    return null;
  }
  return { floorPlan: floorPlan as FloorPlan, sessionNumber: sessionNumber as SessionNumber };
}

/** spawned_object_answer_key.csv를 파싱해 stone(정답 마커) 정보를 추출합니다. */
export function parseAnswerKeyCsv(text: string): ParsedAnswerKey {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV에 데이터 행이 없습니다.");
  }

  const header = parseCsvLine(lines[0]).map((field) => field.trim());
  const columnIndex = (name: string) => header.findIndex((field) => field.toLowerCase() === name.toLowerCase());

  const idx = {
    participantId: columnIndex("participantId"),
    setId: columnIndex("setId"),
    guideMode: columnIndex("guideMode"),
    objectCategory: columnIndex("objectCategory"),
    objectId: columnIndex("objectId"),
    color: columnIndex("color"),
    roomId: columnIndex("roomId"),
    sourceMode: columnIndex("sourceMode"),
    x: columnIndex("x"),
    y: columnIndex("y"),
    z: columnIndex("z"),
  };

  if (idx.participantId < 0 || idx.setId < 0 || idx.objectCategory < 0 || idx.color < 0 || idx.x < 0 || idx.z < 0) {
    throw new Error("CSV 헤더 형식이 올바르지 않습니다. spawned_object_answer_key.csv를 확인해 주세요.");
  }

  let participantId = "";
  let setId = "";
  let guideMode: string | null = null;
  const stones: AnswerKeyStone[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]);
    const category = (fields[idx.objectCategory] ?? "").trim().toLowerCase();
    if (category !== "stone") {
      // incidental 등 다른 행은 채점에 쓰지 않습니다.
      if (!participantId) {
        participantId = (fields[idx.participantId] ?? "").trim();
        setId = (fields[idx.setId] ?? "").trim();
        guideMode = idx.guideMode >= 0 ? (fields[idx.guideMode] ?? "").trim() || null : null;
      }
      continue;
    }

    participantId = participantId || (fields[idx.participantId] ?? "").trim();
    setId = setId || (fields[idx.setId] ?? "").trim();
    guideMode = guideMode ?? (idx.guideMode >= 0 ? (fields[idx.guideMode] ?? "").trim() || null : null);

    const colorRaw = (fields[idx.color] ?? "").trim().toLowerCase();
    const color = COLOR_ALIASES[colorRaw];
    const worldX = toFiniteNumber(fields[idx.x]);
    const worldZ = toFiniteNumber(fields[idx.z]);
    if (!color || worldX === null || worldZ === null) {
      continue;
    }

    stones.push({
      color,
      label: (fields[idx.objectId] ?? "").trim(),
      world_x: worldX,
      world_y: idx.y >= 0 ? toFiniteNumber(fields[idx.y]) : null,
      world_z: worldZ,
      room_id: idx.roomId >= 0 ? (fields[idx.roomId] ?? "").trim() || null : null,
      source_mode: idx.sourceMode >= 0 ? (fields[idx.sourceMode] ?? "").trim() || null : null,
    });
  }

  const split = splitSetId(setId);
  if (!split) {
    throw new Error(`setId "${setId}"에서 평면도·세션을 읽지 못했습니다. (예: FP1-S3)`);
  }
  if (!participantId) {
    throw new Error("CSV에서 participantId를 찾지 못했습니다.");
  }
  if (stones.length === 0) {
    throw new Error("CSV에서 stone(정답 마커) 행을 찾지 못했습니다.");
  }

  return { participantId, floorPlan: split.floorPlan, sessionNumber: split.sessionNumber, setId, guideMode, stones };
}

/** 3x3 선형계 Ax=b를 가우스 소거법으로 풉니다. 특이행렬이면 null을 반환합니다. */
function solve3x3(matrix: number[][], rhs: number[]): number[] | null {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(a[pivot][col]) < 1e-12) {
      return null;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < 3; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = a[row][col] / a[col][col];
      for (let k = col; k < 4; k += 1) {
        a[row][k] -= factor * a[col][k];
      }
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

/** 기준점들로 plan→world 아핀 변환을 최소자승 적합합니다. 기준점이 부족하거나 일직선이면 null입니다. */
export function fitPlanToWorld(points: CalibrationPoint[]): PlanToWorldTransform | null {
  if (points.length < 3) {
    return null;
  }

  // 정규방정식 (AᵀA) c = Aᵀb, A 행 = [px, py, 1]
  const ata = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const atbx = [0, 0, 0];
  const atbz = [0, 0, 0];

  for (const point of points) {
    const row = [point.plan_x, point.plan_y, 1];
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        ata[i][j] += row[i] * row[j];
      }
      atbx[i] += row[i] * point.world_x;
      atbz[i] += row[i] * point.world_z;
    }
  }

  const cx = solve3x3(ata, atbx);
  const cz = solve3x3(ata, atbz);
  if (!cx || !cz) {
    return null;
  }

  return { ax: cx[0], bx: cx[1], cx: cx[2], az: cz[0], bz: cz[1], cz: cz[2] };
}

/** 평면도 정규화 좌표를 월드 좌표(미터)로 변환합니다. */
export function planToWorld(transform: PlanToWorldTransform, planX: number, planY: number): { x: number; z: number } {
  return {
    x: transform.ax * planX + transform.bx * planY + transform.cx,
    z: transform.az * planX + transform.bz * planY + transform.cz,
  };
}

export interface ColorScore {
  color: MarkerColor;
  /** 참가자 마커별, 최적 매칭된 정답과의 거리(미터)입니다. */
  distances: number[];
  withinThreshold: number;
  total: number;
}

export interface ScoreResult {
  thresholdMeters: number;
  totalMarkers: number;
  withinThreshold: number;
  /** 임계거리 내 정답 비율(0~1)입니다. */
  accuracy: number;
  /** 매칭된 모든 거리의 평균(미터)입니다. */
  meanErrorMeters: number;
  byColor: ColorScore[];
}

interface PlanMarker {
  color: MarkerColor;
  x: number;
  y: number;
}

/** 채점에 필요한 정답 스톤의 최소 정보입니다. */
export type ScoringStone = { color: MarkerColor; world_x: number; world_z: number };

/** 3개 이하 원소의 최소비용 완전매칭을 순열 전수로 구합니다. */
function bestMatchingDistances(costs: number[][]): number[] {
  const n = costs.length;
  if (n === 0) {
    return [];
  }
  const indices = Array.from({ length: n }, (_, i) => i);
  let best: number[] | null = null;
  let bestSum = Infinity;

  const permute = (arr: number[], k: number) => {
    if (k === arr.length) {
      const distances = arr.map((col, row) => costs[row][col]);
      const sum = distances.reduce((acc, value) => acc + value, 0);
      if (sum < bestSum) {
        bestSum = sum;
        best = distances;
      }
      return;
    }
    for (let i = k; i < arr.length; i += 1) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      permute(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  permute(indices, 0);
  return best ?? [];
}

/**
 * 색상별로 참가자 마커를 같은 색 정답에 최적 매칭한 뒤, 거리(미터)로 정답률과 평균오차를 계산합니다.
 * 색상만 맞추므로 blue_1/2/3 같은 개별 구분은 사용하지 않습니다.
 */
export function scoreMarkers(
  markers: PlanMarker[],
  stones: ScoringStone[],
  transform: PlanToWorldTransform,
  thresholdMeters: number,
): ScoreResult {
  const byColor: ColorScore[] = [];
  let totalMarkers = 0;
  let withinThresholdTotal = 0;
  let distanceSum = 0;
  let distanceCount = 0;

  for (const color of MARKER_COLORS) {
    const colorMarkers = markers.filter((marker) => marker.color === color);
    const colorStones = stones.filter((stone) => stone.color === color);
    if (colorMarkers.length === 0 || colorStones.length === 0) {
      continue;
    }

    const markerWorld = colorMarkers.map((marker) => planToWorld(transform, marker.x, marker.y));
    // 비용행렬: 행=마커, 열=정답. 정사각이 되도록 작은 쪽 개수에 맞춥니다.
    const size = Math.min(markerWorld.length, colorStones.length);
    const costs: number[][] = [];
    for (let i = 0; i < size; i += 1) {
      const row: number[] = [];
      for (let j = 0; j < size; j += 1) {
        const dx = markerWorld[i].x - colorStones[j].world_x;
        const dz = markerWorld[i].z - colorStones[j].world_z;
        row.push(Math.hypot(dx, dz));
      }
      costs.push(row);
    }

    const distances = bestMatchingDistances(costs);
    const within = distances.filter((distance) => distance <= thresholdMeters).length;

    byColor.push({ color, distances, withinThreshold: within, total: distances.length });
    totalMarkers += distances.length;
    withinThresholdTotal += within;
    distanceSum += distances.reduce((acc, value) => acc + value, 0);
    distanceCount += distances.length;
  }

  return {
    thresholdMeters,
    totalMarkers,
    withinThreshold: withinThresholdTotal,
    accuracy: totalMarkers > 0 ? withinThresholdTotal / totalMarkers : 0,
    meanErrorMeters: distanceCount > 0 ? distanceSum / distanceCount : 0,
    byColor,
  };
}
