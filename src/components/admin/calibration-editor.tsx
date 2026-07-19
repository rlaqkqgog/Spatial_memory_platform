"use client";

import { useRouter } from "next/navigation";
import { useState, type PointerEvent, type SyntheticEvent } from "react";

import { fitPlanToWorld, type CalibrationPoint } from "@/lib/answer-key";
import { FLOOR_PLANS, FLOOR_PLAN_IMAGES, FLOOR_PLAN_LABELS, type FloorPlan } from "@/types/experiment";

/** 편집 중에는 월드 좌표를 문자열로 다뤄 빈 값·입력 중 상태를 허용합니다. */
interface EditablePoint {
  plan_x: number;
  plan_y: number;
  world_x: string;
  world_z: string;
}

interface CalibrationEditorProps {
  initialPoints: Record<FloorPlan, CalibrationPoint[]>;
}

function toEditable(points: CalibrationPoint[]): EditablePoint[] {
  return points.map((point) => ({
    plan_x: point.plan_x,
    plan_y: point.plan_y,
    world_x: String(point.world_x),
    world_z: String(point.world_z),
  }));
}

function toCalibrationPoints(points: EditablePoint[]): CalibrationPoint[] | null {
  const result: CalibrationPoint[] = [];
  for (const point of points) {
    const worldX = Number.parseFloat(point.world_x);
    const worldZ = Number.parseFloat(point.world_z);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldZ)) {
      return null;
    }
    result.push({ plan_x: point.plan_x, plan_y: point.plan_y, world_x: worldX, world_z: worldZ });
  }
  return result;
}

export function CalibrationEditor({ initialPoints }: CalibrationEditorProps) {
  const router = useRouter();
  const [floorPlan, setFloorPlan] = useState<FloorPlan>("FP1");
  const [pointsByPlan, setPointsByPlan] = useState<Record<FloorPlan, EditablePoint[]>>({
    FP1: toEditable(initialPoints.FP1),
    FP2: toEditable(initialPoints.FP2),
  });
  const [aspect, setAspect] = useState<number>(1 / 3);
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "success"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const points = pointsByPlan[floorPlan];

  function updatePoints(update: (current: EditablePoint[]) => EditablePoint[]) {
    setPointsByPlan((current) => ({ ...current, [floorPlan]: update(current[floorPlan]) }));
  }

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setAspect(naturalWidth / naturalHeight);
    }
  }

  function handlePlanClick(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const planX = (event.clientX - rect.left) / rect.width;
    const planY = (event.clientY - rect.top) / rect.height;
    if (planX < 0 || planX > 1 || planY < 0 || planY > 1) {
      return;
    }
    updatePoints((current) => [...current, { plan_x: planX, plan_y: planY, world_x: "", world_z: "" }]);
    setStatus({ kind: "idle", message: "" });
  }

  const parsedPoints = toCalibrationPoints(points);
  const transform = parsedPoints && parsedPoints.length >= 3 ? fitPlanToWorld(parsedPoints) : null;

  async function handleSave() {
    const normalized = toCalibrationPoints(points);
    if (!normalized) {
      setStatus({ kind: "error", message: "모든 기준점의 월드 좌표(X, Z)를 숫자로 입력해 주세요." });
      return;
    }
    setIsSaving(true);
    setStatus({ kind: "idle", message: "" });
    try {
      const response = await fetch(`/api/admin/calibration/${floorPlan}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referencePoints: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "저장 실패");
      }
      setStatus({ kind: "success", message: `${floorPlan} 캘리브레이션을 저장했습니다.` });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "저장 중 오류가 발생했습니다." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex gap-2">
          {FLOOR_PLANS.map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => setFloorPlan(plan)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                plan === floorPlan
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {FLOOR_PLAN_LABELS[plan]}
            </button>
          ))}
        </div>

        <div
          className="relative mx-auto max-h-[70vh] w-full cursor-crosshair overflow-hidden rounded-xl border border-slate-300 bg-slate-100"
          style={{ aspectRatio: String(aspect) }}
          onClick={handlePlanClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 원본 비율 그대로 사용합니다. */}
          <img
            src={FLOOR_PLAN_IMAGES[floorPlan]}
            alt={`평면도 ${floorPlan}`}
            draggable={false}
            onLoad={handleImageLoad}
            className="pointer-events-none h-full w-full select-none"
          />
          {points.map((point, index) => (
            <div
              key={index}
              className="pointer-events-none absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-xs font-bold text-white shadow"
              style={{ left: `${point.plan_x * 100}%`, top: `${point.plan_y * 100}%`, transform: "translate(-50%, -50%)" }}
            >
              {index + 1}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          평면도에서 위치를 아는 기준점을 클릭한 뒤, 오른쪽에 그 지점의 실제 월드 좌표(X, Z)를 입력하세요. 3곳
          이상이면 변환식이 계산됩니다.
        </p>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">기준점 ({points.length})</h2>
            <span className={`text-xs font-semibold ${transform ? "text-emerald-600" : "text-amber-600"}`}>
              {transform ? "변환 계산됨" : "3곳 이상 필요"}
            </span>
          </div>

          {points.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">평면도를 클릭해 기준점을 추가하세요.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {points.map((point, index) => (
                <li key={index} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => updatePoints((current) => current.filter((_, i) => i !== index))}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    평면도 ({point.plan_x.toFixed(3)}, {point.plan_y.toFixed(3)})
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-slate-600">
                      월드 X
                      <input
                        type="number"
                        step="any"
                        value={point.world_x}
                        onChange={(event) =>
                          updatePoints((current) =>
                            current.map((item, i) => (i === index ? { ...item, world_x: event.target.value } : item)),
                          )
                        }
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      월드 Z
                      <input
                        type="number"
                        step="any"
                        value={point.world_z}
                        onChange={(event) =>
                          updatePoints((current) =>
                            current.map((item, i) => (i === index ? { ...item, world_z: event.target.value } : item)),
                          )
                        }
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {status.kind !== "idle" ? (
            <p
              role={status.kind === "error" ? "alert" : "status"}
              className={`mt-3 rounded-xl px-4 py-2 text-sm ${
                status.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {status.message}
            </p>
          ) : null}

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "저장 중…" : `${floorPlan} 캘리브레이션 저장`}
          </button>
        </section>

        <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs leading-5 text-slate-500">
          팁: 정답 CSV의 stone 좌표나 알려진 방 모서리처럼 평면도와 실제 월드 위치를 모두 아는 지점을 기준점으로
          쓰면 정확합니다. 건물이 세로로 길고 회전되어 있어도 3곳 이상이면 자동으로 맞춰집니다.
        </p>
      </aside>
    </div>
  );
}
