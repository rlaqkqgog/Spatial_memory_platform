"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type PointerEvent, type SyntheticEvent } from "react";

import { fitPlanToWorld, type CalibrationPoint } from "@/lib/answer-key";
import { FLOOR_PLANS, FLOOR_PLAN_IMAGES, FLOOR_PLAN_LABELS, type FloorPlan } from "@/types/experiment";

/**
 * 편집 중 기준점입니다. plan_x/plan_y가 null이면 아직 평면도에서 위치를 안 찍은 상태입니다(타워 업로드 직후).
 * world 좌표는 입력 중 상태를 허용하려고 문자열로 다룹니다.
 */
interface EditablePoint {
  plan_x: number | null;
  plan_y: number | null;
  world_x: string;
  world_z: string;
  label?: string;
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

function isComplete(point: EditablePoint): boolean {
  return (
    point.plan_x !== null &&
    point.plan_y !== null &&
    Number.isFinite(Number.parseFloat(point.world_x)) &&
    Number.isFinite(Number.parseFloat(point.world_z))
  );
}

function toCalibrationPoints(points: EditablePoint[]): CalibrationPoint[] {
  return points
    .filter(isComplete)
    .map((point) => ({
      plan_x: point.plan_x as number,
      plan_y: point.plan_y as number,
      world_x: Number.parseFloat(point.world_x),
      world_z: Number.parseFloat(point.world_z),
    }));
}

export function CalibrationEditor({ initialPoints }: CalibrationEditorProps) {
  const router = useRouter();
  const towerInputRef = useRef<HTMLInputElement>(null);
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
  const pendingIndex = points.findIndex((point) => point.plan_x === null);
  const hasIncomplete = points.some((point) => !isComplete(point));
  const completePoints = toCalibrationPoints(points);
  const transform = completePoints.length >= 3 ? fitPlanToWorld(completePoints) : null;

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

    updatePoints((current) => {
      const nextPending = current.findIndex((point) => point.plan_x === null);
      if (nextPending >= 0) {
        // 업로드된 타워 등 평면도 위치가 비어 있는 기준점에 이 클릭 위치를 배정합니다.
        return current.map((point, index) =>
          index === nextPending ? { ...point, plan_x: planX, plan_y: planY } : point,
        );
      }
      // 없으면 월드 좌표를 직접 입력할 새 기준점을 추가합니다.
      return [...current, { plan_x: planX, plan_y: planY, world_x: "", world_z: "" }];
    });
    setStatus({ kind: "idle", message: "" });
  }

  async function handleTowerFile(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    try {
      const json = JSON.parse(await files[0].text()) as { towers?: { tower_id?: string; fallback_x?: number; fallback_z?: number }[] };
      const towers = Array.isArray(json.towers) ? json.towers : [];
      const newPoints: EditablePoint[] = towers
        .filter((tower) => Number.isFinite(tower.fallback_x) && Number.isFinite(tower.fallback_z))
        .map((tower) => ({
          plan_x: null,
          plan_y: null,
          world_x: String(tower.fallback_x),
          world_z: String(tower.fallback_z),
          label: tower.tower_id ?? "Tower",
        }));
      if (newPoints.length === 0) {
        throw new Error("towers 배열을 찾지 못했습니다.");
      }
      updatePoints((current) => [...current, ...newPoints]);
      setStatus({
        kind: "success",
        message: `타워 ${newPoints.length}개를 불러왔습니다. 평면도에서 각 타워 위치를 순서대로 클릭하세요.`,
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? `타워 JSON을 읽지 못했습니다: ${error.message}` : "타워 JSON을 읽지 못했습니다.",
      });
    } finally {
      if (towerInputRef.current) {
        towerInputRef.current.value = "";
      }
    }
  }

  async function handleSave() {
    if (hasIncomplete) {
      setStatus({
        kind: "error",
        message: "아직 평면도 위치를 안 찍었거나 월드 좌표가 비어 있는 기준점이 있습니다.",
      });
      return;
    }
    setIsSaving(true);
    setStatus({ kind: "idle", message: "" });
    try {
      const response = await fetch(`/api/admin/calibration/${floorPlan}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referencePoints: completePoints }),
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
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
          <div>
            <input
              ref={towerInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => handleTowerFile(event.target.files)}
            />
            <button
              type="button"
              onClick={() => towerInputRef.current?.click()}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              타워 앵커 JSON 불러오기
            </button>
          </div>
        </div>

        {pendingIndex >= 0 ? (
          <p className="mb-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
            평면도에서 <span className="font-bold">{points[pendingIndex].label ?? `기준점 ${pendingIndex + 1}`}</span>{" "}
            위치를 클릭하세요.
          </p>
        ) : null}

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
          {points.map((point, index) =>
            point.plan_x !== null && point.plan_y !== null ? (
              <div
                key={index}
                className="pointer-events-none absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-xs font-bold text-white shadow"
                style={{ left: `${point.plan_x * 100}%`, top: `${point.plan_y * 100}%`, transform: "translate(-50%, -50%)" }}
              >
                {index + 1}
              </div>
            ) : null,
          )}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">타워 앵커 JSON</span>(device_snapshot/fp1_fixed_tower_anchors.json)을
          불러오면 타워들의 월드 좌표가 자동으로 채워집니다. 각 타워를 평면도에서 클릭하기만 하면 됩니다. 직접
          입력하려면 평면도의 아는 지점을 클릭한 뒤 월드 좌표를 적으세요. 3곳 이상이면 변환식이 계산됩니다.
        </p>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">기준점 ({points.length})</h2>
            <span className={`text-xs font-semibold ${transform ? "text-emerald-600" : "text-amber-600"}`}>
              {transform ? "변환 계산됨" : "완성된 기준점 3곳 이상 필요"}
            </span>
          </div>

          {points.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">타워 JSON을 불러오거나 평면도를 클릭해 기준점을 추가하세요.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {points.map((point, index) => (
                <li key={index} className={`rounded-xl border p-3 ${isComplete(point) ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                        {index + 1}
                      </span>
                      {point.label ?? "기준점"}
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
                    {point.plan_x !== null && point.plan_y !== null
                      ? `평면도 (${point.plan_x.toFixed(3)}, ${point.plan_y.toFixed(3)})`
                      : "평면도 위치 미지정 — 평면도에서 클릭하세요"}
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
          팁: 정답과 같은 좌표계인 <span className="font-semibold">고정 타워 앵커</span>를 기준점으로 쓰면 정확합니다.
          모든 참가자·세션이 같은 프레임이라 평면도마다 한 번만 설정하면 전체 채점에 적용됩니다.
        </p>
      </aside>
    </div>
  );
}
