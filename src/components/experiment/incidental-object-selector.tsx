"use client";

import type { IncidentalObjectDef } from "@/types/experiment";

interface IncidentalObjectSelectorProps {
  objects: IncidentalObjectDef[];
  activeObjectId: string | null;
  placedObjectIds: Set<string>;
  isDisabled: boolean;
  onSelect: (objectId: string) => void;
}

export function IncidentalObjectSelector({
  objects,
  activeObjectId,
  placedObjectIds,
  isDisabled,
  onSelect,
}: IncidentalObjectSelectorProps) {
  return (
    <section aria-labelledby="incidental-object-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="incidental-object-title" className="text-sm font-semibold text-slate-800">
        우연객체 선택
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        객체를 선택한 뒤 평면도에서 기억나는 위치를 클릭하세요. 객체마다 하나의 위치를 입력합니다.
      </p>
      <ul className="mt-3 space-y-2">
        {objects.map((objectDef, index) => {
          const isActive = objectDef.id === activeObjectId;
          const isPlaced = placedObjectIds.has(objectDef.id);

          return (
            <li key={objectDef.id}>
              <button
                type="button"
                disabled={isDisabled}
                aria-pressed={isActive}
                onClick={() => onSelect(objectDef.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? "border-violet-600 bg-violet-50 text-violet-900 ring-2 ring-violet-200"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                      isPlaced ? "bg-violet-500" : "bg-slate-300"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {objectDef.label}
                </span>
                <span className={`text-xs font-semibold ${isPlaced ? "text-violet-600" : "text-slate-400"}`}>
                  {isPlaced ? "배치됨" : "미배치"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
