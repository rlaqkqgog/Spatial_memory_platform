"use client";

import { useState } from "react";

import { ColorSelector } from "@/components/experiment/color-selector";
import { ExperimentInstructions } from "@/components/experiment/experiment-instructions";
import { FloorPlanCanvas, type CanvasMarker } from "@/components/experiment/floor-plan-canvas";
import { IncidentalObjectSelector } from "@/components/experiment/incidental-object-selector";
import { MarkerProgress } from "@/components/experiment/marker-progress";
import { ParticipantIdForm, type ExperimentSetup } from "@/components/experiment/participant-id-form";
import { canPlaceMarker, getRemainingMarkersByColor } from "@/lib/markers";
import { submitExperiment, submitIncidental } from "@/lib/submission-client";
import {
  buildExperimentCode,
  getIncidentalObjects,
  GUIDE_TYPE_LABELS,
  TOTAL_MARKERS,
  type ExperimentEvent,
  type FloorPlan,
  type GuideType,
  type IncidentalEvent,
  type IncidentalMarker,
  type Marker,
  type MarkerColor,
  type SessionNumber,
} from "@/types/experiment";

type Notice = { kind: "error" | "info"; message: string } | null;

function now(): string {
  return new Date().toISOString();
}

export function ExperimentClient() {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [guideType, setGuideType] = useState<GuideType | null>(null);
  const [sessionNumber, setSessionNumber] = useState<SessionNumber | null>(null);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<MarkerColor>("red");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [events, setEvents] = useState<ExperimentEvent[]>([]);
  const [deletedMarkerCount, setDeletedMarkerCount] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // 2단계: 우연객체 위치 응답 상태입니다.
  const [incidentalStartedAt, setIncidentalStartedAt] = useState<string | null>(null);
  const [incidentalMarkers, setIncidentalMarkers] = useState<IncidentalMarker[]>([]);
  const [incidentalEvents, setIncidentalEvents] = useState<IncidentalEvent[]>([]);
  const [incidentalDeletedCount, setIncidentalDeletedCount] = useState(0);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [incidentalSubmissionId, setIncidentalSubmissionId] = useState<string | null>(null);

  const remainingByColor = getRemainingMarkersByColor(markers);
  const isMainSubmitted = submissionId !== null;
  const isIncidentalSubmitted = incidentalSubmissionId !== null;
  const isInteractionDisabled = isSubmitting || isMainSubmitted;
  const isIncidentalDisabled = isSubmitting || isIncidentalSubmitted;

  const incidentalObjects =
    floorPlan && sessionNumber ? getIncidentalObjects(floorPlan, sessionNumber) : [];
  const placedObjectIds = new Set(incidentalMarkers.map((marker) => marker.objectId));

  function appendEvent(event: ExperimentEvent) {
    setEvents((currentEvents) => [...currentEvents, event]);
  }

  function appendIncidentalEvent(event: IncidentalEvent) {
    setIncidentalEvents((currentEvents) => [...currentEvents, event]);
  }

  function handleStart(setup: ExperimentSetup) {
    const started = now();
    setParticipantId(setup.participantId);
    setGuideType(setup.guideType);
    setSessionNumber(setup.sessionNumber);
    setFloorPlan(setup.floorPlan);
    setStartedAt(started);
    setEvents([{ type: "start", occurredAt: started }]);
  }

  function handleColorSelect(color: MarkerColor) {
    if (isInteractionDisabled) {
      return;
    }

    setActiveColor(color);
    appendEvent({ type: "color_select", color, occurredAt: now() });
    setNotice(null);
  }

  function handlePlaceMarker(x: number, y: number) {
    if (isInteractionDisabled) {
      return;
    }

    if (!canPlaceMarker(markers, activeColor)) {
      setNotice({ kind: "error", message: `이미 ${activeColor} 마커를 3개 입력했습니다. 다른 색상을 선택해 주세요.` });
      return;
    }

    const placedAt = now();
    const marker: Marker = {
      id: crypto.randomUUID(),
      color: activeColor,
      x,
      y,
      placedAt,
      moveCount: 0,
    };

    setMarkers((currentMarkers) => [...currentMarkers, marker]);
    appendEvent({ type: "marker_place", markerId: marker.id, color: marker.color, x, y, occurredAt: placedAt });
    setNotice(null);
  }

  function handleMarkerPositionChange(markerId: string, x: number, y: number, commit: boolean) {
    if (isInteractionDisabled) {
      return;
    }

    const movedMarker = markers.find((marker) => marker.id === markerId);
    if (!movedMarker) {
      return;
    }

    setMarkers((currentMarkers) =>
      currentMarkers.map((marker) =>
        marker.id === markerId
          ? { ...marker, x, y, moveCount: marker.moveCount + (commit ? 1 : 0) }
          : marker,
      ),
    );

    if (commit) {
      appendEvent({ type: "marker_move", markerId, color: movedMarker.color, x, y, occurredAt: now() });
    }
  }

  function handleDeleteMarker(markerId: string) {
    if (isInteractionDisabled) {
      return;
    }

    const deletedMarker = markers.find((marker) => marker.id === markerId);
    if (!deletedMarker) {
      return;
    }

    setMarkers((currentMarkers) => currentMarkers.filter((marker) => marker.id !== markerId));
    setDeletedMarkerCount((count) => count + 1);
    appendEvent({
      type: "marker_delete",
      markerId,
      color: deletedMarker.color,
      x: deletedMarker.x,
      y: deletedMarker.y,
      occurredAt: now(),
    });
  }

  function handleReset() {
    if (isInteractionDisabled || markers.length === 0) {
      return;
    }

    if (!window.confirm("입력한 마커를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    const deletedAt = now();
    setDeletedMarkerCount((count) => count + markers.length);
    setEvents((currentEvents) => [
      ...currentEvents,
      ...markers.map((marker) => ({
        type: "marker_delete" as const,
        markerId: marker.id,
        color: marker.color,
        x: marker.x,
        y: marker.y,
        occurredAt: deletedAt,
      })),
    ]);
    setMarkers([]);
    setNotice({ kind: "info", message: "모든 마커를 초기화했습니다." });
  }

  async function handleSubmit() {
    if (!participantId || !guideType || !sessionNumber || !floorPlan || !startedAt || isInteractionDisabled) {
      return;
    }

    if (markers.length !== TOTAL_MARKERS) {
      setNotice({ kind: "error", message: `제출하려면 마커 ${TOTAL_MARKERS}개를 모두 입력해야 합니다.` });
      return;
    }

    const submittedAt = now();
    const submitEvent: ExperimentEvent = { type: "submit", occurredAt: submittedAt };
    const submissionEvents = [...events, submitEvent];
    setEvents(submissionEvents);
    setIsSubmitting(true);
    setNotice(null);

    try {
      const { submissionId: savedId } = await submitExperiment({
        experimentCode: buildExperimentCode(floorPlan, sessionNumber),
        participantId,
        guideType,
        startedAt,
        submittedAt,
        deletedMarkerCount,
        markers,
        events: submissionEvents,
      });
      setSubmissionId(savedId);

      // 2단계(우연객체) 응답을 시작합니다.
      const incidentalStarted = now();
      setIncidentalStartedAt(incidentalStarted);
      setIncidentalEvents([{ type: "start", occurredAt: incidentalStarted }]);
      const objects = getIncidentalObjects(floorPlan, sessionNumber);
      setActiveObjectId(objects[0]?.id ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "응답을 저장하지 못했습니다.";
      setNotice({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleObjectSelect(objectId: string) {
    if (isIncidentalDisabled) {
      return;
    }

    setActiveObjectId(objectId);
    appendIncidentalEvent({ type: "object_select", objectId, occurredAt: now() });
    setNotice(null);
  }

  function advanceToNextUnplacedObject(justPlacedObjectId: string) {
    const placedNow = new Set(incidentalMarkers.map((marker) => marker.objectId));
    placedNow.add(justPlacedObjectId);
    const nextObject = incidentalObjects.find((objectDef) => !placedNow.has(objectDef.id));
    setActiveObjectId(nextObject?.id ?? null);
  }

  function handleIncidentalPlace(x: number, y: number) {
    if (isIncidentalDisabled) {
      return;
    }

    if (!activeObjectId) {
      setNotice({ kind: "error", message: "먼저 오른쪽 목록에서 우연객체를 선택해 주세요." });
      return;
    }

    if (placedObjectIds.has(activeObjectId)) {
      setNotice({
        kind: "error",
        message: "이 객체는 이미 배치되어 있습니다. 마커를 드래그해 옮기거나 × 버튼으로 삭제한 뒤 다시 배치하세요.",
      });
      return;
    }

    const placedAt = now();
    const marker: IncidentalMarker = {
      id: crypto.randomUUID(),
      objectId: activeObjectId,
      x,
      y,
      placedAt,
      moveCount: 0,
    };

    setIncidentalMarkers((currentMarkers) => [...currentMarkers, marker]);
    appendIncidentalEvent({
      type: "marker_place",
      markerId: marker.id,
      objectId: marker.objectId,
      x,
      y,
      occurredAt: placedAt,
    });
    advanceToNextUnplacedObject(activeObjectId);
    setNotice(null);
  }

  function handleIncidentalPositionChange(markerId: string, x: number, y: number, commit: boolean) {
    if (isIncidentalDisabled) {
      return;
    }

    const movedMarker = incidentalMarkers.find((marker) => marker.id === markerId);
    if (!movedMarker) {
      return;
    }

    setIncidentalMarkers((currentMarkers) =>
      currentMarkers.map((marker) =>
        marker.id === markerId
          ? { ...marker, x, y, moveCount: marker.moveCount + (commit ? 1 : 0) }
          : marker,
      ),
    );

    if (commit) {
      appendIncidentalEvent({ type: "marker_move", markerId, objectId: movedMarker.objectId, x, y, occurredAt: now() });
    }
  }

  function handleIncidentalDelete(markerId: string) {
    if (isIncidentalDisabled) {
      return;
    }

    const deletedMarker = incidentalMarkers.find((marker) => marker.id === markerId);
    if (!deletedMarker) {
      return;
    }

    setIncidentalMarkers((currentMarkers) => currentMarkers.filter((marker) => marker.id !== markerId));
    setIncidentalDeletedCount((count) => count + 1);
    appendIncidentalEvent({
      type: "marker_delete",
      markerId,
      objectId: deletedMarker.objectId,
      x: deletedMarker.x,
      y: deletedMarker.y,
      occurredAt: now(),
    });
    // 삭제한 객체를 다시 배치할 수 있게 활성 객체로 되돌립니다.
    setActiveObjectId(deletedMarker.objectId);
  }

  function handleIncidentalReset() {
    if (isIncidentalDisabled || incidentalMarkers.length === 0) {
      return;
    }

    if (!window.confirm("입력한 우연객체 마커를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    const deletedAt = now();
    setIncidentalDeletedCount((count) => count + incidentalMarkers.length);
    setIncidentalEvents((currentEvents) => [
      ...currentEvents,
      ...incidentalMarkers.map((marker) => ({
        type: "marker_delete" as const,
        markerId: marker.id,
        objectId: marker.objectId,
        x: marker.x,
        y: marker.y,
        occurredAt: deletedAt,
      })),
    ]);
    setIncidentalMarkers([]);
    setActiveObjectId(incidentalObjects[0]?.id ?? null);
    setNotice({ kind: "info", message: "모든 우연객체 마커를 초기화했습니다." });
  }

  async function handleIncidentalSubmit() {
    if (
      !participantId ||
      !guideType ||
      !sessionNumber ||
      !floorPlan ||
      !incidentalStartedAt ||
      !submissionId ||
      isIncidentalDisabled
    ) {
      return;
    }

    if (incidentalMarkers.length !== incidentalObjects.length) {
      setNotice({
        kind: "error",
        message: `제출하려면 우연객체 ${incidentalObjects.length}개의 위치를 모두 입력해야 합니다.`,
      });
      return;
    }

    const submittedAt = now();
    const submitEvent: IncidentalEvent = { type: "submit", occurredAt: submittedAt };
    const submissionEvents = [...incidentalEvents, submitEvent];
    setIncidentalEvents(submissionEvents);
    setIsSubmitting(true);
    setNotice(null);

    try {
      const { submissionId: savedId } = await submitIncidental({
        experimentCode: buildExperimentCode(floorPlan, sessionNumber),
        participantId,
        guideType,
        mainSubmissionId: submissionId,
        startedAt: incidentalStartedAt,
        submittedAt,
        deletedMarkerCount: incidentalDeletedCount,
        markers: incidentalMarkers,
        events: submissionEvents,
      });
      setIncidentalSubmissionId(savedId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "응답을 저장하지 못했습니다.";
      setNotice({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!participantId || !floorPlan) {
    return <ParticipantIdForm onStart={handleStart} />;
  }

  if (isMainSubmitted && isIncidentalSubmitted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
        <section className="w-full rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">제출 완료</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">모든 응답이 저장되었습니다.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            연구자의 다음 안내를 기다려 주세요. 제출된 응답은 더 이상 수정할 수 없습니다.
          </p>
          <p className="mt-5 text-xs text-slate-400">본 응답 저장 번호: {submissionId}</p>
          <p className="mt-1 text-xs text-slate-400">우연객체 저장 번호: {incidentalSubmissionId}</p>
        </section>
      </main>
    );
  }

  const isIncidentalPhase = isMainSubmitted;
  const headerBadge = isIncidentalPhase ? "2단계 · 우연객체 위치" : "1단계 · 위치 응답";
  const activeObject = incidentalObjects.find((objectDef) => objectDef.id === activeObjectId) ?? null;

  const canvasMarkers: CanvasMarker[] = isIncidentalPhase
    ? incidentalMarkers.map((marker) => {
        const objectIndex = incidentalObjects.findIndex((objectDef) => objectDef.id === marker.objectId);
        const objectDef = objectIndex >= 0 ? incidentalObjects[objectIndex] : null;
        return {
          id: marker.id,
          color: "incidental",
          x: marker.x,
          y: marker.y,
          badge: objectIndex >= 0 ? String(objectIndex + 1) : "?",
          label: objectDef?.label ?? marker.objectId,
        };
      })
    : markers;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구 · {headerBadge}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {isIncidentalPhase ? "우연객체 위치 입력" : "위치 응답 입력"}
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            참가자 번호: <span className="font-semibold text-slate-900">{participantId}</span>
            {guideType ? <> · 가이드: <span className="font-semibold text-slate-900">{GUIDE_TYPE_LABELS[guideType]}</span></> : null}
            {sessionNumber ? <> · 세션: <span className="font-semibold text-slate-900">{sessionNumber}</span></> : null}
            <> · 평면도: <span className="font-semibold text-slate-900">{floorPlan}</span></>
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            aria-label={isIncidentalPhase ? "우연객체 위치 입력" : "평면도 응답 입력"}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <FloorPlanCanvas
              floorPlan={floorPlan}
              markers={canvasMarkers}
              isDisabled={isIncidentalPhase ? isIncidentalDisabled : isInteractionDisabled}
              onPlaceMarker={isIncidentalPhase ? handleIncidentalPlace : handlePlaceMarker}
              onDeleteMarker={isIncidentalPhase ? handleIncidentalDelete : handleDeleteMarker}
              onMarkerPositionChange={isIncidentalPhase ? handleIncidentalPositionChange : handleMarkerPositionChange}
            />
            <p className="mt-3 text-sm text-slate-500">
              {isIncidentalPhase
                ? activeObject
                  ? `지금 배치할 객체: ${activeObject.label} — 기억나는 위치를 클릭하세요. 이동 버튼으로 화면을 움직일 수 있습니다.`
                  : "모든 우연객체를 배치했습니다. 위치를 확인한 뒤 제출해 주세요."
                : "이동 버튼을 켜고 드래그하면 평면도가 이동하고, 휠로 확대·축소할 수 있습니다. 이동 버튼을 끄고 빈 위치를 클릭해 선택한 색상의 마커를 배치하세요."}
            </p>
          </section>

          <aside className="space-y-4">
            {isIncidentalPhase ? (
              <>
                <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-violet-900">우연객체 위치 회상</h2>
                  <p className="mt-1 text-xs leading-5 text-violet-800">
                    체험 중 우연히 본 물건들입니다. 각 물건이 있던 위치를 평면도에 표시해 주세요. 기억이 확실하지
                    않아도 가장 가깝다고 생각하는 위치를 선택하면 됩니다.
                  </p>
                </section>
                <IncidentalObjectSelector
                  objects={incidentalObjects}
                  activeObjectId={activeObjectId}
                  placedObjectIds={placedObjectIds}
                  isDisabled={isIncidentalDisabled}
                  onSelect={handleObjectSelect}
                />
                <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  입력 현황: <span className="font-semibold text-slate-900">{incidentalMarkers.length}</span> /{" "}
                  {incidentalObjects.length}
                </p>
              </>
            ) : (
              <>
                <ExperimentInstructions />
                <ColorSelector
                  activeColor={activeColor}
                  remainingByColor={remainingByColor}
                  onSelect={handleColorSelect}
                />
                <MarkerProgress remainingByColor={remainingByColor} placedCount={markers.length} />
              </>
            )}

            {notice ? (
              <p
                role={notice.kind === "error" ? "alert" : "status"}
                className={`rounded-xl px-4 py-3 text-sm ${
                  notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                }`}
              >
                {notice.message}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  isIncidentalPhase
                    ? isIncidentalDisabled || incidentalMarkers.length === 0
                    : isInteractionDisabled || markers.length === 0
                }
                onClick={isIncidentalPhase ? handleIncidentalReset : handleReset}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                전체 초기화
              </button>
              <button
                type="button"
                disabled={isIncidentalPhase ? isIncidentalDisabled : isInteractionDisabled}
                onClick={isIncidentalPhase ? handleIncidentalSubmit : handleSubmit}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "저장 중…" : "제출"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
