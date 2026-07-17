"use client";

import { useState, type FormEvent } from "react";

import { GUIDE_TYPES, GUIDE_TYPE_LABELS, type GuideType } from "@/types/experiment";

interface ParticipantIdFormProps {
  onStart: (participantId: string, guideType: GuideType) => void;
}

export function ParticipantIdForm({ onStart }: ParticipantIdFormProps) {
  const [participantId, setParticipantId] = useState("");
  const [guideType, setGuideType] = useState<GuideType | "">("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedId = participantId.trim();

    if (normalizedId.length < 2) {
      setErrorMessage("참가자 번호를 두 글자 이상 입력해 주세요.");
      return;
    }

    if (!guideType) {
      setErrorMessage("체험한 가이드 유형을 선택해 주세요.");
      return;
    }

    setErrorMessage(null);
    onStart(normalizedId, guideType);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">참가자 정보 입력</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          연구자에게 안내받은 참가자 ID를 입력한 뒤 실험을 시작해 주세요. 제출 전까지 응답을 수정할 수 있습니다.
        </p>

        <form className="mt-8" onSubmit={handleSubmit} noValidate>
          <label htmlFor="participant-id" className="text-sm font-semibold text-slate-800">
            참가자 ID
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
            placeholder="예: P001"
            aria-describedby={errorMessage ? "participant-id-error" : undefined}
          />
          <label htmlFor="guide-type" className="mt-5 block text-sm font-semibold text-slate-800">
            체험한 가이드 유형
          </label>
          <select
            id="guide-type"
            name="guideType"
            value={guideType}
            onChange={(event) => setGuideType(event.target.value as GuideType | "")}
            required
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
            aria-describedby={errorMessage ? "participant-id-error" : undefined}
          >
            <option value="">가이드 유형을 선택해 주세요</option>
            {GUIDE_TYPES.map((type) => (
              <option key={type} value={type}>
                {GUIDE_TYPE_LABELS[type]}
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
