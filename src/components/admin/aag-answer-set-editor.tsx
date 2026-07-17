"use client";

import { useMemo, useState } from "react";

import {
  AAG_MARKER_COLORS,
  type AagAnswerMarkerInput,
  type AagAnswerSetStatus,
  type AagFloorPlanId,
  type AagSetId,
  type AagMarkerColor,
  validateAagAnswerSet,
} from "@/lib/aag-answer-set";

interface AnswerSetData {
  floorPlanId: AagFloorPlanId;
  setId: AagSetId;
  status: AagAnswerSetStatus;
  seed: string | null;
  generatorVersion: string | null;
  authoringSettings: Record<string, unknown>;
  markers: AagAnswerMarkerInput[];
  validation: ReturnType<typeof validateAagAnswerSet>;
}

interface EditableMarker {
  answerMarkerId: string;
  color: AagMarkerColor;
  label: string;
  worldX: string;
  worldY: string;
  worldZ: string;
  planX: string;
  planY: string;
}

interface AagAnswerSetEditorProps {
  answerSet: AnswerSetData;
}

export function AagAnswerSetEditor({ answerSet }: AagAnswerSetEditorProps) {
  const [markers, setMarkers] = useState<EditableMarker[]>(() => answerSet.markers.map(toEditableMarker));
  const [seed, setSeed] = useState(answerSet.seed ?? "");
  const [generatorVersion, setGeneratorVersion] = useState(answerSet.generatorVersion ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currentValidation = useMemo(() => {
    const completeMarkers = markers.flatMap((marker) => {
      const parsed = parseEditableMarker(marker);
      return parsed ? [parsed] : [];
    });
    return validateAagAnswerSet(completeMarkers);
  }, [markers]);

  function updateMarker(index: number, key: keyof EditableMarker, value: string) {
    setMarkers((current) => current.map((marker, markerIndex) => (
      markerIndex === index ? { ...marker, [key]: value } : marker
    )));
  }

  function addMarker() {
    setMarkers((current) => current.length >= 12 ? current : [
      ...current,
      {
        answerMarkerId: crypto.randomUUID(),
        color: "red",
        label: "",
        worldX: "",
        worldY: "",
        worldZ: "",
        planX: "",
        planY: "",
      },
    ]);
  }

  function removeMarker(index: number) {
    setMarkers((current) => current.filter((_, markerIndex) => markerIndex !== index));
  }

  async function saveDraft(): Promise<boolean> {
    const parsedMarkers = markers.map(parseEditableMarker);
    if (parsedMarkers.some((marker) => marker === null)) {
      setMessage("각 오브젝트의 label과 world/plan 좌표를 모두 입력해 주세요.");
      return false;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/aag-answer-sets/${answerSet.floorPlanId}/${answerSet.setId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markers: parsedMarkers, seed, generatorVersion }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setMessage(body?.message ?? "세트를 저장하지 못했습니다.");
        return false;
      }
      setMessage("초안이 저장되었습니다.");
      return true;
    } catch {
      setMessage("네트워크 오류로 세트를 저장하지 못했습니다.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeStatus(status: AagAnswerSetStatus) {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/aag-answer-sets/${answerSet.floorPlanId}/${answerSet.setId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setMessage(body?.message ?? "세트 상태를 변경하지 못했습니다.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("네트워크 오류로 세트 상태를 변경하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveAndMarkReady() {
    if (await saveDraft()) await changeStatus("ready");
  }

  const isReady = answerSet.status === "ready";
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-600">AAG object placement</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{answerSet.floorPlanId}-{answerSet.setId}</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {isReady ? "ready" : "draft"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          실제 MRUK world 좌표와 웹 평면도 정규화 좌표를 함께 입력합니다. 경계·zone·최소 거리·벽 clearance는 아직 TBD이며 이 화면에서는 임의로 검증하지 않습니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-800">
          Seed (optional)
          <input disabled={isReady} value={seed} onChange={(event) => setSeed(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Generator version (optional)
          <input disabled={isReady} value={generatorVersion} onChange={(event) => setGeneratorVersion(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
        </label>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Authoring constraints</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(answerSet.authoringSettings).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <dt className="font-medium text-slate-700">{key}</dt>
              <dd className="text-slate-600">{typeof value === "string" ? value : JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Answer markers</h2>
            <p className="mt-1 text-sm text-slate-600">초안은 최대 12개까지 저장할 수 있으며, ready에는 정확히 색상별 3개가 필요합니다.</p>
          </div>
          {!isReady ? <button type="button" onClick={addMarker} disabled={markers.length >= 12 || isSubmitting} className="rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">오브젝트 추가</button> : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[920px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-2 py-3">color</th><th className="px-2 py-3">label</th><th className="px-2 py-3">world x</th><th className="px-2 py-3">world y</th><th className="px-2 py-3">world z</th><th className="px-2 py-3">plan x</th><th className="px-2 py-3">plan y</th><th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {markers.map((marker, index) => (
                <tr key={marker.answerMarkerId}>
                  <td className="px-2 py-2"><select disabled={isReady} value={marker.color} onChange={(event) => updateMarker(index, "color", event.target.value)} className="rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100">{AAG_MARKER_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}</select></td>
                  <td className="px-2 py-2"><input disabled={isReady} value={marker.label} onChange={(event) => updateMarker(index, "label", event.target.value)} className="w-36 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" aria-label={`Marker ${index + 1} label`} /></td>
                  {(["worldX", "worldY", "worldZ", "planX", "planY"] as const).map((coordinate) => <td key={coordinate} className="px-2 py-2"><input disabled={isReady} type="number" step="any" value={marker[coordinate]} onChange={(event) => updateMarker(index, coordinate, event.target.value)} className="w-24 rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100" aria-label={`Marker ${index + 1} ${coordinate}`} /></td>)}
                  <td className="px-2 py-2">{!isReady ? <button type="button" onClick={() => removeMarker(index)} disabled={isSubmitting} className="text-sm font-semibold text-red-700">삭제</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Validation</h2>
        <p className="mt-2 text-sm text-slate-700">현재 입력 완료 행: {currentValidation.markerCount} / 12 · red {currentValidation.colorCounts.red} · blue {currentValidation.colorCounts.blue} · green {currentValidation.colorCounts.green} · yellow {currentValidation.colorCounts.yellow}</p>
        <p className="mt-1 text-sm text-slate-600">plan 좌표 범위 오류: {currentValidation.outOfRangePlanCoordinateCount} · {currentValidation.isValid ? "ready 조건 충족" : "ready 조건 미충족"}</p>
        {message ? <p role="alert" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {!isReady ? <><button type="button" onClick={saveDraft} disabled={isSubmitting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">draft 저장</button><button type="button" onClick={saveAndMarkReady} disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">검증 후 ready 처리</button></> : <><button type="button" onClick={() => changeStatus("draft")} disabled={isSubmitting} className="rounded-lg border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50">draft로 되돌리기</button><a href={`/api/admin/aag-answer-sets/${answerSet.floorPlanId}/${answerSet.setId}/csv`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">CSV 내보내기</a></>}
        </div>
      </section>
    </section>
  );
}

function toEditableMarker(marker: AagAnswerMarkerInput): EditableMarker {
  return {
    answerMarkerId: marker.answerMarkerId,
    color: marker.color,
    label: marker.label,
    worldX: String(marker.worldX),
    worldY: String(marker.worldY),
    worldZ: String(marker.worldZ),
    planX: String(marker.planX),
    planY: String(marker.planY),
  };
}

function parseEditableMarker(marker: EditableMarker): AagAnswerMarkerInput | null {
  const worldX = Number(marker.worldX);
  const worldY = Number(marker.worldY);
  const worldZ = Number(marker.worldZ);
  const planX = Number(marker.planX);
  const planY = Number(marker.planY);
  return marker.label.trim() &&
    marker.worldX.trim() && marker.worldY.trim() && marker.worldZ.trim() && marker.planX.trim() && marker.planY.trim() &&
    [worldX, worldY, worldZ, planX, planY].every(Number.isFinite)
    ? { answerMarkerId: marker.answerMarkerId, color: marker.color, label: marker.label.trim(), worldX, worldY, worldZ, planX, planY }
    : null;
}
