"use client";

import { useState, type FormEvent } from "react";

import {
  FLOOR_PLANS,
  FLOOR_PLAN_LABELS,
  isValidExperimentDate,
  type ExperimentSetup,
  type FloorPlan,
} from "@/types/experiment";

interface ParticipantIdFormProps {
  onStart: (setup: ExperimentSetup) => void;
}

const SELECT_CLASS =
  "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100";

function today(): string {
  const now = new Date();
  const offsetMs = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(offsetMs).toISOString().slice(0, 10);
}

export function ParticipantIdForm({ onStart }: ParticipantIdFormProps) {
  const [participantId, setParticipantId] = useState("");
  const [experimentDate, setExperimentDate] = useState(today());
  const [floorPlan, setFloorPlan] = useState<FloorPlan | "">("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = participantId.trim();

    if (normalizedId.length < 2) {
      setErrorMessage("참가자 번호 또는 성함을 두 글자 이상 입력해 주세요.");
      return;
    }

    if (!isValidExperimentDate(experimentDate)) {
      setErrorMessage("대면 실험 날짜를 선택해 주세요.");
      return;
    }

    if (!floorPlan) {
      setErrorMessage("평면도를 선택해 주세요.");
      return;
    }

    setErrorMessage(null);
    onStart({ participantId: normalizedId, experimentDate, floorPlan });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">참가자 정보 입력</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          참가자 번호(또는 성함)와 대면 실험 날짜를 입력한 뒤 실험을 시작해 주세요. 위치 응답은 가이드별로 각각
          입력합니다.
        </p>

        <form className="mt-8" onSubmit={handleSubmit} noValidate>
          <label htmlFor="participant-id" className="text-sm font-semibold text-slate-800">
            참가자 번호 또는 성함
          </label>
          <input
            id="participant-id"
            name="participantId"
            value={participantId}
            onChange={(event) => setParticipantId(event.target.value)}
            autoComplete="off"
            autoFocus
            maxLength={100}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
            placeholder="예: P001 또는 홍길동"
            aria-describedby={errorMessage ? "participant-id-error" : undefined}
          />

          <label htmlFor="experiment-date" className="mt-5 block text-sm font-semibold text-slate-800">
            대면 실험 날짜
          </label>
          <input
            id="experiment-date"
            name="experimentDate"
            type="date"
            value={experimentDate}
            onChange={(event) => setExperimentDate(event.target.value)}
            className={SELECT_CLASS}
            aria-describedby={errorMessage ? "participant-id-error" : undefined}
          />

          <label htmlFor="floor-plan" className="mt-5 block text-sm font-semibold text-slate-800">
            평면도
          </label>
          <select
            id="floor-plan"
            name="floorPlan"
            value={floorPlan}
            onChange={(event) => setFloorPlan(event.target.value as FloorPlan | "")}
            required
            className={SELECT_CLASS}
            aria-describedby={errorMessage ? "participant-id-error" : undefined}
          >
            <option value="">평면도를 선택해 주세요</option>
            {FLOOR_PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {FLOOR_PLAN_LABELS[plan]}
              </option>
            ))}
          </select>

          {errorMessage ? (
            <p id="participant-id-error" role="alert" className="mt-2 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
          >
            실험 시작
          </button>
        </form>
      </section>
    </main>
  );
}
