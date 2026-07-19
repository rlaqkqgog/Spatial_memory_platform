"use client";

import type { IncidentalObjectDef } from "@/types/experiment";

interface IncidentalRecognitionFormProps {
  objects: IncidentalObjectDef[];
  /** objectId → seen(봤음 여부). 아직 답하지 않은 객체는 키가 없습니다. */
  answers: Map<string, boolean>;
  isDisabled: boolean;
  onAnswer: (objectId: string, seen: boolean) => void;
}

export function IncidentalRecognitionForm({
  objects,
  answers,
  isDisabled,
  onAnswer,
}: IncidentalRecognitionFormProps) {
  return (
    <section
      aria-labelledby="incidental-recognition-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <h2 id="incidental-recognition-title" className="text-lg font-semibold text-slate-900">
        물건 목록
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        각 물건에 대해 체험 중 공간에서 본 적이 있는지 선택해 주세요.
      </p>

      <ul className="mt-5 divide-y divide-slate-100">
        {objects.map((objectDef, index) => {
          const answer = answers.get(objectDef.id);

          return (
            <li key={objectDef.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-800">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    answer === undefined ? "bg-slate-200 text-slate-500" : "bg-indigo-600 text-white"
                  }`}
                >
                  {index + 1}
                </span>
                {objectDef.label}
              </span>
              <div role="radiogroup" aria-label={`${objectDef.label}을(를) 본 적이 있나요?`} className="flex gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={answer === true}
                  disabled={isDisabled}
                  onClick={() => onAnswer(objectDef.id, true)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    answer === true
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  봤음
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={answer === false}
                  disabled={isDisabled}
                  onClick={() => onAnswer(objectDef.id, false)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    answer === false
                      ? "border-rose-600 bg-rose-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  못 봤음
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
