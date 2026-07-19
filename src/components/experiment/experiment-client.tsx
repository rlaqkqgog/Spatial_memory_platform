"use client";

import { useState } from "react";

import { ColorSelector } from "@/components/experiment/color-selector";
import { ExperimentInstructions } from "@/components/experiment/experiment-instructions";
import { FloorPlanCanvas } from "@/components/experiment/floor-plan-canvas";
import { IncidentalRecognitionForm } from "@/components/experiment/incidental-recognition-form";
import { MarkerProgress } from "@/components/experiment/marker-progress";
import { ParticipantIdForm } from "@/components/experiment/participant-id-form";
import { canPlaceMarker, getRemainingMarkersByColor } from "@/lib/markers";
import { submitExperiment, submitIncidentalRecognition } from "@/lib/submission-client";
import {
  buildExperimentCode,
  getIncidentalObjects,
  GUIDE_TYPE_LABELS,
  SESSION_NUMBERS,
  SESSION_NUMBER_LABELS,
  TOTAL_MARKERS,
  type ExperimentEvent,
  type ExperimentSetup,
  type FloorPlan,
  type GuideType,
  type IncidentalRecognitionResponse,
  type Marker,
  type MarkerColor,
  type SessionNumber,
} from "@/types/experiment";

/** 화면에 표시하고 응답하는 가이드 순서입니다. */
const GUIDE_ORDER: GuideType[] = ["AAG", "VG", "NG"];

type Phase = "position" | "incidental" | "done";
type Notice = { kind: "error" | "info"; message: string } | null;

function now(): string {
  return new Date().toISOString();
}

function byGuide<T>(factory: (guide: GuideType) => T): Record<GuideType, T> {
  return { AAG: factory("AAG"), VG: factory("VG"), NG: factory("NG") };
}

export function ExperimentClient() {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [experimentDate, setExperimentDate] = useState<string | null>(null);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [phase, setPhase] = useState<Phase>("position");
  const [notice, setNotice] = useState<Notice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1단계: 가이드별 위치 응답 상태입니다.
  const [positionStartedAt, setPositionStartedAt] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<GuideType>("AAG");
  const [activeColor, setActiveColor] = useState<MarkerColor>("red");
  const [markersByGuide, setMarkersByGuide] = useState<Record<GuideType, Marker[]>>(byGuide(() => []));
  const [eventsByGuide, setEventsByGuide] = useState<Record<GuideType, ExperimentEvent[]>>(byGuide(() => []));
  const [deletedByGuide, setDeletedByGuide] = useState<Record<GuideType, number>>(byGuide(() => 0));
  const [positionIdByGuide, setPositionIdByGuide] = useState<Record<GuideType, string | null>>(byGuide(() => null));

  // 2단계: 가이드별 우연객체 재인 검사 상태입니다.
  const [recognitionStartedAt, setRecognitionStartedAt] = useState<string | null>(null);
  const [sessionByGuide, setSessionByGuide] = useState<Record<GuideType, SessionNumber | "">>(byGuide(() => ""));
  const [recognitionByGuide, setRecognitionByGuide] = useState<
    Record<GuideType, Map<string, IncidentalRecognitionResponse>>
  >(byGuide(() => new Map()));
  const [recognitionIdByGuide, setRecognitionIdByGuide] = useState<Record<GuideType, string | null>>(
    byGuide(() => null),
  );

  const markers = markersByGuide[activeGuide];
  const remainingByColor = getRemainingMarkersByColor(markers);
  const allGuidesComplete = GUIDE_ORDER.every((guide) => markersByGuide[guide].length === TOTAL_MARKERS);
  const isPositionDisabled = isSubmitting || phase !== "position";

  function updateActiveGuide<T>(
    setter: (updater: (current: Record<GuideType, T>) => Record<GuideType, T>) => void,
    update: (currentValue: T) => T,
  ) {
    setter((current) => ({ ...current, [activeGuide]: update(current[activeGuide]) }));
  }

  function appendActiveEvent(event: ExperimentEvent) {
    updateActiveGuide(setEventsByGuide, (events) => [...events, event]);
  }

  function handleStart(setup: ExperimentSetup) {
    const started = now();
    setParticipantId(setup.participantId);
    setExperimentDate(setup.experimentDate);
    setFloorPlan(setup.floorPlan);
    setPositionStartedAt(started);
    setEventsByGuide(byGuide(() => [{ type: "start", occurredAt: started }]));
    setActiveGuide("AAG");
    setPhase("position");
  }

  function handleGuideSelect(guide: GuideType) {
    if (isPositionDisabled) {
      return;
    }
    setActiveGuide(guide);
    setNotice(null);
  }

  function handleColorSelect(color: MarkerColor) {
    if (isPositionDisabled) {
      return;
    }
    setActiveColor(color);
    appendActiveEvent({ type: "color_select", color, occurredAt: now() });
    setNotice(null);
  }

  function handlePlaceMarker(x: number, y: number) {
    if (isPositionDisabled) {
      return;
    }

    if (!canPlaceMarker(markers, activeColor)) {
      setNotice({ kind: "error", message: `이미 ${activeColor} 마커를 3개 입력했습니다. 다른 색상을 선택해 주세요.` });
      return;
    }

    const placedAt = now();
    const marker: Marker = { id: crypto.randomUUID(), color: activeColor, x, y, placedAt, moveCount: 0 };
    updateActiveGuide(setMarkersByGuide, (currentMarkers) => [...currentMarkers, marker]);
    appendActiveEvent({ type: "marker_place", markerId: marker.id, color: marker.color, x, y, occurredAt: placedAt });
    setNotice(null);
  }

  function handleMarkerPositionChange(markerId: string, x: number, y: number, commit: boolean) {
    if (isPositionDisabled) {
      return;
    }

    const movedMarker = markers.find((marker) => marker.id === markerId);
    if (!movedMarker) {
      return;
    }

    updateActiveGuide(setMarkersByGuide, (currentMarkers) =>
      currentMarkers.map((marker) =>
        marker.id === markerId ? { ...marker, x, y, moveCount: marker.moveCount + (commit ? 1 : 0) } : marker,
      ),
    );

    if (commit) {
      appendActiveEvent({ type: "marker_move", markerId, color: movedMarker.color, x, y, occurredAt: now() });
    }
  }

  function handleDeleteMarker(markerId: string) {
    if (isPositionDisabled) {
      return;
    }

    const deletedMarker = markers.find((marker) => marker.id === markerId);
    if (!deletedMarker) {
      return;
    }

    updateActiveGuide(setMarkersByGuide, (currentMarkers) => currentMarkers.filter((marker) => marker.id !== markerId));
    updateActiveGuide(setDeletedByGuide, (count) => count + 1);
    appendActiveEvent({
      type: "marker_delete",
      markerId,
      color: deletedMarker.color,
      x: deletedMarker.x,
      y: deletedMarker.y,
      occurredAt: now(),
    });
  }

  function handleReset() {
    if (isPositionDisabled || markers.length === 0) {
      return;
    }

    if (!window.confirm(`${GUIDE_TYPE_LABELS[activeGuide]}의 마커를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    const deletedAt = now();
    updateActiveGuide(setDeletedByGuide, (count) => count + markers.length);
    updateActiveGuide(setEventsByGuide, (events) => [
      ...events,
      ...markers.map((marker) => ({
        type: "marker_delete" as const,
        markerId: marker.id,
        color: marker.color,
        x: marker.x,
        y: marker.y,
        occurredAt: deletedAt,
      })),
    ]);
    updateActiveGuide(setMarkersByGuide, () => []);
    setNotice({ kind: "info", message: `${GUIDE_TYPE_LABELS[activeGuide]}의 마커를 초기화했습니다.` });
  }

  /**
   * 위치 응답은 아직 저장하지 않고 2단계로 넘어갑니다.
   * 실제 저장은 마지막 제출에서 한꺼번에 하므로, 2단계에서 위치 응답으로 돌아가 자유롭게 수정할 수 있습니다.
   */
  function handleProceedToIncidental() {
    if (!participantId || !experimentDate || !floorPlan || isSubmitting) {
      return;
    }

    const incompleteGuide = GUIDE_ORDER.find((guide) => markersByGuide[guide].length !== TOTAL_MARKERS);
    if (incompleteGuide) {
      setNotice({
        kind: "error",
        message: `${GUIDE_TYPE_LABELS[incompleteGuide]}의 마커가 ${markersByGuide[incompleteGuide].length}/${TOTAL_MARKERS}개입니다. 세 가이드 모두 ${TOTAL_MARKERS}개를 입력해야 합니다.`,
      });
      setActiveGuide(incompleteGuide);
      return;
    }

    setNotice(null);
    setRecognitionStartedAt(now());
    setPhase("incidental");
  }

  function handleBackToPosition() {
    if (isSubmitting) {
      return;
    }
    setNotice(null);
    setPhase("position");
  }

  function handleSessionSelect(guide: GuideType, session: SessionNumber | "") {
    if (isSubmitting || recognitionIdByGuide[guide]) {
      return;
    }
    setSessionByGuide((current) => ({ ...current, [guide]: session }));
    // 세션을 바꾸면 객체 목록이 달라지므로 해당 가이드의 응답을 초기화합니다.
    setRecognitionByGuide((current) => ({ ...current, [guide]: new Map() }));
    setNotice(null);
  }

  function handleRecognitionAnswer(guide: GuideType, objectId: string, seen: boolean) {
    if (isSubmitting || recognitionIdByGuide[guide]) {
      return;
    }

    setRecognitionByGuide((current) => {
      const guideAnswers = new Map(current[guide]);
      const existing = guideAnswers.get(objectId);
      if (existing && existing.seen === seen) {
        return current;
      }
      guideAnswers.set(objectId, {
        objectId,
        seen,
        answeredAt: now(),
        changeCount: existing ? existing.changeCount + 1 : 0,
      });
      return { ...current, [guide]: guideAnswers };
    });
    setNotice(null);
  }

  async function handleIncidentalSubmit() {
    if (!participantId || !experimentDate || !floorPlan || !positionStartedAt || !recognitionStartedAt || isSubmitting) {
      return;
    }

    for (const guide of GUIDE_ORDER) {
      const session = sessionByGuide[guide];
      if (!session) {
        setNotice({ kind: "error", message: `${GUIDE_TYPE_LABELS[guide]}의 세션을 선택해 주세요.` });
        return;
      }
      const objects = getIncidentalObjects(session);
      if (recognitionByGuide[guide].size !== objects.length) {
        setNotice({
          kind: "error",
          message: `${GUIDE_TYPE_LABELS[guide]}의 물건 ${objects.length}개 모두에 답해야 합니다. (현재 ${recognitionByGuide[guide].size}개)`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    setNotice(null);

    // 위치 응답과 우연객체 응답을 마지막에 함께 저장합니다. 이미 저장된 항목은 재시도 시 건너뜁니다.
    const positionSubmittedAt = now();
    const recognitionSubmittedAt = now();
    const savedPositionIds = { ...positionIdByGuide };
    const savedRecognitionIds = { ...recognitionIdByGuide };
    try {
      for (const guide of GUIDE_ORDER) {
        if (savedPositionIds[guide]) {
          continue;
        }
        const submissionEvents = [...eventsByGuide[guide], { type: "submit" as const, occurredAt: positionSubmittedAt }];
        const { submissionId } = await submitExperiment({
          experimentCode: floorPlan,
          participantId,
          experimentDate,
          guideType: guide,
          startedAt: positionStartedAt,
          submittedAt: positionSubmittedAt,
          deletedMarkerCount: deletedByGuide[guide],
          markers: markersByGuide[guide],
          events: submissionEvents,
        });
        savedPositionIds[guide] = submissionId;
      }
      setPositionIdByGuide(savedPositionIds);

      for (const guide of GUIDE_ORDER) {
        if (savedRecognitionIds[guide]) {
          continue;
        }
        const session = sessionByGuide[guide] as SessionNumber;
        const objects = getIncidentalObjects(session);
        const responses = objects
          .map((objectDef) => recognitionByGuide[guide].get(objectDef.id))
          .filter((response): response is IncidentalRecognitionResponse => response !== undefined);

        const { submissionId } = await submitIncidentalRecognition({
          experimentCode: buildExperimentCode(floorPlan, session),
          participantId,
          guideType: guide,
          mainSubmissionId: savedPositionIds[guide] ?? "",
          startedAt: recognitionStartedAt,
          submittedAt: recognitionSubmittedAt,
          responses,
        });
        savedRecognitionIds[guide] = submissionId;
      }
      setRecognitionIdByGuide(savedRecognitionIds);
      setPhase("done");
    } catch (error) {
      setPositionIdByGuide(savedPositionIds);
      setRecognitionIdByGuide(savedRecognitionIds);
      const message = error instanceof Error ? error.message : "응답을 저장하지 못했습니다.";
      setNotice({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!participantId || !experimentDate || !floorPlan) {
    return <ParticipantIdForm onStart={handleStart} />;
  }

  const headerLine = (
    <p className="text-sm text-slate-600">
      참가자: <span className="font-semibold text-slate-900">{participantId}</span>
      <> · 날짜: <span className="font-semibold text-slate-900">{experimentDate}</span></>
      <> · 평면도: <span className="font-semibold text-slate-900">{floorPlan}</span></>
    </p>
  );

  const noticeBox = notice ? (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm ${
        notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
      }`}
    >
      {notice.message}
    </p>
  ) : null;

  if (phase === "done") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
        <section className="w-full rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">제출 완료</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">모든 응답이 저장되었습니다.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            세 가이드(AAG·VG·NG)의 위치 응답과 우연객체 확인이 모두 저장되었습니다. 연구자의 다음 안내를 기다려
            주세요.
          </p>
          <div className="mt-5 space-y-1 text-xs text-slate-400">
            {GUIDE_ORDER.map((guide) => (
              <p key={guide}>
                {GUIDE_TYPE_LABELS[guide]}: {positionIdByGuide[guide]?.slice(0, 8) ?? "-"} · 우연객체{" "}
                {recognitionIdByGuide[guide]?.slice(0, 8) ?? "-"}
              </p>
            ))}
          </div>
        </section>
      </main>
    );
  }

  // 2단계: 가이드별 우연객체 재인 검사 화면입니다.
  if (phase === "incidental") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구 · 2단계</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">우연객체 확인</h1>
            </div>
            {headerLine}
          </header>

          <section className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <p className="text-sm leading-6 text-indigo-900">
              가이드별로 어떤 세션을 진행했는지 선택한 뒤, 각 물건을 그 체험 중에 <span className="font-semibold">본 적이 있는지</span>{" "}
              골라 주세요. 위치는 기억하지 않아도 됩니다.
            </p>
          </section>

          <div className="space-y-6">
            {GUIDE_ORDER.map((guide) => {
              const session = sessionByGuide[guide];
              const objects = session ? getIncidentalObjects(session) : [];
              const answers = recognitionByGuide[guide];

              return (
                <section key={guide} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <h2 className="text-lg font-semibold text-slate-900">{GUIDE_TYPE_LABELS[guide]}</h2>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      세션
                      <select
                        value={session}
                        disabled={isSubmitting || recognitionIdByGuide[guide] !== null}
                        onChange={(event) => handleSessionSelect(guide, event.target.value as SessionNumber | "")}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                      >
                        <option value="">세션 선택</option>
                        {SESSION_NUMBERS.map((sessionNumber) => (
                          <option key={sessionNumber} value={sessionNumber}>
                            {SESSION_NUMBER_LABELS[sessionNumber]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {session ? (
                    <div className="mt-4">
                      <IncidentalRecognitionForm
                        objects={objects}
                        answers={new Map([...answers].map(([objectId, response]) => [objectId, response.seen]))}
                        isDisabled={isSubmitting || recognitionIdByGuide[guide] !== null}
                        onAnswer={(objectId, seen) => handleRecognitionAnswer(guide, objectId, seen)}
                      />
                      <p className="mt-3 text-right text-sm text-slate-600">
                        응답: <span className="font-semibold text-slate-900">{answers.size}</span> / {objects.length}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">먼저 이 가이드에서 진행한 세션을 선택해 주세요.</p>
                  )}
                </section>
              );
            })}

            {noticeBox}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBackToPosition}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← 위치 응답 수정
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleIncidentalSubmit}
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "저장 중…" : "최종 제출"}
              </button>
            </div>
            <p className="text-right text-xs text-slate-400">
              위치 응답과 우연객체 확인은 최종 제출 시 함께 저장됩니다. 그 전까지 자유롭게 수정할 수 있습니다.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // 1단계: 가이드별 위치 응답 화면입니다.
  const guideButtons = (
    <div className="flex flex-col gap-2">
      {GUIDE_ORDER.map((guide) => {
        const count = markersByGuide[guide].length;
        const isComplete = count === TOTAL_MARKERS;
        const isActive = guide === activeGuide;
        return (
          <button
            key={guide}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleGuideSelect(guide)}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition ${
              isActive
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white/95 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{guide}</span>
            <span className={`text-xs ${isActive ? "text-indigo-100" : isComplete ? "text-emerald-600" : "text-slate-400"}`}>
              {count}/{TOTAL_MARKERS}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구 · 1단계</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">위치 응답 입력</h1>
          </div>
          {headerLine}
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-label="평면도 응답 입력" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <FloorPlanCanvas
              floorPlan={floorPlan}
              markers={markers}
              isDisabled={isPositionDisabled}
              onPlaceMarker={handlePlaceMarker}
              onDeleteMarker={handleDeleteMarker}
              onMarkerPositionChange={handleMarkerPositionChange}
              topLeftOverlay={guideButtons}
            />
            <p className="mt-3 text-sm text-slate-500">
              왼쪽 위에서 가이드(AAG·VG·NG)를 선택하면 그 가이드의 위치를 입력합니다. 세 가이드 모두 마커
              {TOTAL_MARKERS}개씩 입력한 뒤 제출하세요. 이동 버튼을 켜면 드래그로 평면도를 옮길 수 있습니다.
            </p>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800">
                현재 가이드: <span className="text-indigo-700">{GUIDE_TYPE_LABELS[activeGuide]}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">평면도 왼쪽 위 버튼으로 가이드를 전환할 수 있습니다.</p>
            </section>
            <ExperimentInstructions />
            <ColorSelector activeColor={activeColor} remainingByColor={remainingByColor} onSelect={handleColorSelect} />
            <MarkerProgress remainingByColor={remainingByColor} placedCount={markers.length} />

            {noticeBox}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isPositionDisabled || markers.length === 0}
                onClick={handleReset}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                현재 가이드 초기화
              </button>
              <button
                type="button"
                disabled={isSubmitting || !allGuidesComplete}
                onClick={handleProceedToIncidental}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                다음: 우연객체 확인
              </button>
            </div>
            {!allGuidesComplete ? (
              <p className="text-center text-xs text-slate-400">
                세 가이드 모두 {TOTAL_MARKERS}개를 입력하면 다음 단계로 넘어갈 수 있습니다.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
