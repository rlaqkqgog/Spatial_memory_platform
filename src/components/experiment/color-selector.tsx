import { MARKER_COLORS, type MarkerColor } from "@/types/experiment";

const COLOR_LABELS: Record<MarkerColor, string> = {
  red: "빨강",
  blue: "파랑",
  green: "초록",
  yellow: "노랑",
};

const COLOR_STYLES: Record<MarkerColor, string> = {
  red: "border-red-500 bg-red-50 text-red-900",
  blue: "border-blue-500 bg-blue-50 text-blue-900",
  green: "border-emerald-500 bg-emerald-50 text-emerald-900",
  yellow: "border-amber-500 bg-amber-50 text-amber-900",
};

interface ColorSelectorProps {
  activeColor: MarkerColor;
  remainingByColor: Record<MarkerColor, number>;
  onSelect: (color: MarkerColor) => void;
}

export function ColorSelector({
  activeColor,
  remainingByColor,
  onSelect,
}: ColorSelectorProps) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">마커 색상 선택</legend>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MARKER_COLORS.map((color) => {
          const isActive = activeColor === color;
          const isComplete = remainingByColor[color] === 0;

          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              aria-pressed={isActive}
              className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                isActive ? COLOR_STYLES[color] : "border-slate-200 bg-white text-slate-700"
              } ${isComplete ? "opacity-55" : "hover:border-slate-400"}`}
            >
              <span className="block">{COLOR_LABELS[color]}</span>
              <span className="mt-1 block text-xs font-medium">남은 개수: {remainingByColor[color]} / 3</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
