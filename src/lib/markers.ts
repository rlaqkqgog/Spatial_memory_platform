import {
  MARKER_COLORS,
  MAX_MARKERS_PER_COLOR,
  type Marker,
  type MarkerColor,
} from "@/types/experiment";

/** 입력 좌표가 평면도의 유효 범위를 넘지 않도록 제한합니다. */
export function clampNormalizedCoordinate(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function countMarkersByColor(markers: Marker[], color: MarkerColor): number {
  return markers.filter((marker) => marker.color === color).length;
}

export function getRemainingMarkersByColor(
  markers: Marker[],
): Record<MarkerColor, number> {
  return Object.fromEntries(
    MARKER_COLORS.map((color) => [
      color,
      Math.max(0, MAX_MARKERS_PER_COLOR - countMarkersByColor(markers, color)),
    ]),
  ) as Record<MarkerColor, number>;
}

export function canPlaceMarker(markers: Marker[], color: MarkerColor): boolean {
  return countMarkersByColor(markers, color) < MAX_MARKERS_PER_COLOR;
}
