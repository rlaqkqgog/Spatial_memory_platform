import { MARKER_COLORS, TOTAL_MARKERS, type MarkerColor } from "@/types/experiment";

const COLOR_LABELS: Record<MarkerColor, string> = {
  red: "빨강",
  blue: "파랑",
  green: "초록",
  yellow: "노랑",
};

interface MarkerProgressProps {
  remainingByColor: Record<MarkerColor, number>;
  placedCount: number;
}

export function MarkerProgress({ remainingByColor, placedCount }: MarkerProgressProps) {
  return (
    <section aria-labelledby="progress-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="progress-title" className="text-lg font-semibold text-slate-900">
          입력 현황
        </h2>
        <p className="text-sm font-semibold text-indigo-700">
          {placedCount} / {TOTAL_MARKERS}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-600 transition-[width]"
          style={{ width: `${(placedCount / TOTAL_MARKERS) * 100}%` }}
        />
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600">
        {MARKER_COLORS.map((color) => (
          <li key={color} className="flex justify-between">
            <span>{COLOR_LABELS[color]}</span>
            <span className="font-medium text-slate-800">{3 - remainingByColor[color]} / 3</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
