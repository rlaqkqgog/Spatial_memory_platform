"use client";

import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";

import { clampNormalizedCoordinate } from "@/lib/markers";
import { FLOOR_PLAN_IMAGES, type FloorPlan, type Marker, type MarkerColor } from "@/types/experiment";

const MARKER_STYLE: Record<MarkerColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
};

interface DragState {
  id: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  markers: Marker[];
  isDisabled: boolean;
  onPlaceMarker: (x: number, y: number) => void;
  onDeleteMarker: (markerId: string) => void;
  /** commit이 true일 때만 마커 이동 횟수를 기록합니다. */
  onMarkerPositionChange: (markerId: string, x: number, y: number, commit: boolean) => void;
}

function getNormalizedCoordinates(
  event: Pick<PointerEvent<HTMLDivElement>, "clientX" | "clientY">,
  element: HTMLDivElement,
) {
  const rect = element.getBoundingClientRect();

  return {
    x: clampNormalizedCoordinate((event.clientX - rect.left) / rect.width),
    y: clampNormalizedCoordinate((event.clientY - rect.top) / rect.height),
  };
}

export function FloorPlanCanvas({
  floorPlan,
  markers,
  isDisabled,
  onPlaceMarker,
  onDeleteMarker,
  onMarkerPositionChange,
}: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const ignoreNextClickRef = useRef(false);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);

  function handleCanvasClick(event: PointerEvent<HTMLDivElement>) {
    if (isDisabled || !canvasRef.current) {
      return;
    }

    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }

    const { x, y } = getNormalizedCoordinates(event, canvasRef.current);
    onPlaceMarker(x, y);
  }

  function handleMarkerPointerDown(event: PointerEvent<HTMLDivElement>, marker: Marker) {
    if (isDisabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    ignoreNextClickRef.current = true;
    dragRef.current = {
      id: marker.id,
      startX: marker.x,
      startY: marker.y,
      hasMoved: false,
    };
    setDraggingMarkerId(marker.id);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const activeDrag = dragRef.current;
    if (!activeDrag || !canvasRef.current || isDisabled) {
      return;
    }

    const { x, y } = getNormalizedCoordinates(event, canvasRef.current);
    const movedEnough = Math.abs(x - activeDrag.startX) > 0.002 || Math.abs(y - activeDrag.startY) > 0.002;

    activeDrag.hasMoved ||= movedEnough;
    onMarkerPositionChange(activeDrag.id, x, y, false);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const activeDrag = dragRef.current;
    if (!activeDrag || !canvasRef.current) {
      return;
    }

    if (activeDrag.hasMoved) {
      const { x, y } = getNormalizedCoordinates(event, canvasRef.current);
      onMarkerPositionChange(activeDrag.id, x, y, true);
    }

    dragRef.current = null;
    setDraggingMarkerId(null);
  }

  function handlePointerCancel() {
    dragRef.current = null;
    setDraggingMarkerId(null);
  }

  return (
    <div
      ref={canvasRef}
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-inner ${
        isDisabled ? "cursor-not-allowed" : "cursor-crosshair"
      }`}
      aria-label="평면도. 클릭하여 마커를 배치합니다."
      onClick={handleCanvasClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* 실제 실험 도면은 public/floor-plan-fp1.svg, floor-plan-fp2.svg 파일로 교체합니다. */}
      <Image
        src={FLOOR_PLAN_IMAGES[floorPlan]}
        alt={`실험용 평면도 ${floorPlan}`}
        fill
        sizes="(max-width: 1024px) 100vw, 75vw"
        className="pointer-events-none select-none object-cover"
        draggable={false}
      />

      {markers.map((marker) => (
        <div
          key={marker.id}
          role="img"
          aria-label={`${marker.color} 마커`}
          className={`absolute h-8 w-8 touch-none select-none rounded-full border-2 border-white shadow-md transition-shadow ${
            MARKER_STYLE[marker.color]
          } ${draggingMarkerId === marker.id ? "z-20 scale-110 cursor-grabbing" : "z-10 cursor-grab"}`}
          style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%`, transform: "translate(-50%, -50%)" }}
          onPointerDown={(event) => handleMarkerPointerDown(event, marker)}
        >
          <button
            type="button"
            aria-label={`${marker.color} 마커 삭제`}
            disabled={isDisabled}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white opacity-95 shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:hidden"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteMarker(marker.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
