"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from "react";

import { clampNormalizedCoordinate } from "@/lib/markers";
import { FLOOR_PLAN_IMAGES, type FloorPlan, type Marker, type MarkerColor } from "@/types/experiment";

const MARKER_STYLE: Record<MarkerColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
};

/** 줌 1은 평면도 전체가 화면에 들어오는 fit 상태입니다. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const BUTTON_ZOOM_FACTOR = 1.5;
const WHEEL_ZOOM_INTENSITY = 0.0015;
const PAN_THRESHOLD_PX = 4;

interface DragState {
  id: string;
  startX: number;
  startY: number;
  hasMoved: boolean;
}

interface PanState {
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  hasMoved: boolean;
}

interface ViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
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

/** 도면이 뷰포트보다 작으면 가운데 정렬하고, 크면 빈 공간이 보이지 않도록 오프셋을 제한합니다. */
function clampOffset(offset: number, worldSize: number, viewportSize: number): number {
  if (worldSize <= viewportSize) {
    return (viewportSize - worldSize) / 2;
  }
  return Math.min(0, Math.max(viewportSize - worldSize, offset));
}

/** naturalWidth를 제공하지 않는 브라우저를 위해 SVG viewBox에서 가로/세로 비율을 읽습니다. */
async function readSvgAspect(src: string): Promise<number | null> {
  try {
    const response = await fetch(src);
    const text = await response.text();
    const viewBox = text.match(/viewBox\s*=\s*["']\s*[\d.eE+-]+[\s,]+[\d.eE+-]+[\s,]+([\d.eE+-]+)[\s,]+([\d.eE+-]+)/);
    if (!viewBox) {
      return null;
    }
    const width = Number.parseFloat(viewBox[1]);
    const height = Number.parseFloat(viewBox[2]);
    return width > 0 && height > 0 ? width / height : null;
  } catch {
    return null;
  }
}

export function FloorPlanCanvas({
  floorPlan,
  markers,
  isDisabled,
  onPlaceMarker,
  onDeleteMarker,
  onMarkerPositionChange,
}: FloorPlanCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [renderedFloorPlan, setRenderedFloorPlan] = useState(floorPlan);

  // 평면도가 바뀌면 렌더 중에 화면 상태를 초기화합니다. (https://react.dev/learn/you-might-not-need-an-effect)
  if (renderedFloorPlan !== floorPlan) {
    setRenderedFloorPlan(floorPlan);
    setImageAspect(null);
    setView({ zoom: 1, offsetX: 0, offsetY: 0 });
  }

  // 스페이스바를 누르고 있는 동안 손바닥(팬) 모드로 전환합니다. 입력 필드에 타이핑 중일 때는 무시합니다.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      return (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setIsSpaceHeld(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setIsSpaceHeld(false);
      }
    }

    function handleWindowBlur() {
      setIsSpaceHeld(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewportSize({ width, height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback(
    (centerX: number, centerY: number, factor: number) => {
      if (!imageAspect || !viewportSize) {
        return;
      }

      setView((current) => {
        const fitWidth = Math.min(viewportSize.width, viewportSize.height * imageAspect);
        const fitHeight = fitWidth / imageAspect;
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * factor));
        if (nextZoom === current.zoom) {
          return current;
        }

        const currentLeft = clampOffset(current.offsetX, fitWidth * current.zoom, viewportSize.width);
        const currentTop = clampOffset(current.offsetY, fitHeight * current.zoom, viewportSize.height);
        const ratio = nextZoom / current.zoom;
        return {
          zoom: nextZoom,
          offsetX: centerX - (centerX - currentLeft) * ratio,
          offsetY: centerY - (centerY - currentTop) * ratio,
        };
      });
    },
    [imageAspect, viewportSize],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        Math.exp(-event.deltaY * WHEEL_ZOOM_INTENSITY),
      );
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setImageAspect(naturalWidth / naturalHeight);
      return;
    }

    void readSvgAspect(FLOOR_PLAN_IMAGES[floorPlan]).then((aspect) => {
      if (aspect) {
        setImageAspect(aspect);
      }
    });
  }

  /** 도면(world) 기준 정규화 좌표입니다. 도면 밖 클릭은 0~1 범위를 벗어난 값이 됩니다. */
  function getWorldCoordinates(event: Pick<PointerEvent<HTMLDivElement>, "clientX" | "clientY">) {
    const world = worldRef.current;
    if (!world) {
      return null;
    }

    const rect = world.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  /** 클릭 이벤트 대신 pointerdown→pointerup 이동 거리로 배치를 판정해 팬 제스처와 확실히 구분합니다. */
  function placeMarkerAt(event: Pick<PointerEvent<HTMLDivElement>, "clientX" | "clientY">) {
    if (isDisabled || isSpaceHeld) {
      return;
    }

    const coordinates = getWorldCoordinates(event);
    if (!coordinates || coordinates.x < 0 || coordinates.x > 1 || coordinates.y < 0 || coordinates.y > 1) {
      return;
    }

    onPlaceMarker(clampNormalizedCoordinate(coordinates.x), clampNormalizedCoordinate(coordinates.y));
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !worldRef.current || !viewportRef.current) {
      return;
    }

    const worldRect = worldRef.current.getBoundingClientRect();
    const viewportRect = viewportRef.current.getBoundingClientRect();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 포인터가 이미 해제된 경우 캡처 없이 계속합니다.
    }
    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: worldRect.left - viewportRect.left,
      startOffsetY: worldRect.top - viewportRect.top,
      hasMoved: false,
    };
  }

  function handleMarkerPointerDown(event: PointerEvent<HTMLDivElement>, marker: Marker) {
    // 스페이스 팬 모드에서는 마커를 잡지 않고 이벤트를 캔버스로 흘려 화면 이동만 하게 합니다.
    if (isDisabled || isSpaceHeld) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 포인터가 이미 해제된 경우 캡처 없이 계속합니다.
    }
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
    if (activeDrag && !isDisabled) {
      const coordinates = getWorldCoordinates(event);
      if (!coordinates) {
        return;
      }

      const x = clampNormalizedCoordinate(coordinates.x);
      const y = clampNormalizedCoordinate(coordinates.y);
      const movedEnough = Math.abs(x - activeDrag.startX) > 0.002 || Math.abs(y - activeDrag.startY) > 0.002;

      activeDrag.hasMoved ||= movedEnough;
      onMarkerPositionChange(activeDrag.id, x, y, false);
      return;
    }

    const activePan = panRef.current;
    if (!activePan) {
      return;
    }

    const deltaX = event.clientX - activePan.startClientX;
    const deltaY = event.clientY - activePan.startClientY;
    if (!activePan.hasMoved && Math.hypot(deltaX, deltaY) > PAN_THRESHOLD_PX) {
      activePan.hasMoved = true;
      setIsPanning(true);
    }

    if (activePan.hasMoved) {
      setView((current) => ({
        ...current,
        offsetX: activePan.startOffsetX + deltaX,
        offsetY: activePan.startOffsetY + deltaY,
      }));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const activeDrag = dragRef.current;
    if (activeDrag) {
      if (activeDrag.hasMoved) {
        const coordinates = getWorldCoordinates(event);
        if (coordinates) {
          onMarkerPositionChange(
            activeDrag.id,
            clampNormalizedCoordinate(coordinates.x),
            clampNormalizedCoordinate(coordinates.y),
            true,
          );
        }
      }

      dragRef.current = null;
      setDraggingMarkerId(null);
      return;
    }

    const activePan = panRef.current;
    if (activePan) {
      panRef.current = null;
      setIsPanning(false);
      if (!activePan.hasMoved) {
        placeMarkerAt(event);
      }
    }
  }

  function handlePointerCancel() {
    dragRef.current = null;
    panRef.current = null;
    setDraggingMarkerId(null);
    setIsPanning(false);
  }

  function handleZoomButton(factor: number) {
    if (!viewportSize) {
      return;
    }
    zoomAt(viewportSize.width / 2, viewportSize.height / 2, factor);
  }

  function handleResetView() {
    setView({ zoom: 1, offsetX: 0, offsetY: 0 });
  }

  const world =
    imageAspect && viewportSize
      ? (() => {
          const fitWidth = Math.min(viewportSize.width, viewportSize.height * imageAspect);
          const fitHeight = fitWidth / imageAspect;
          const width = fitWidth * view.zoom;
          const height = fitHeight * view.zoom;
          return {
            width,
            height,
            left: clampOffset(view.offsetX, width, viewportSize.width),
            top: clampOffset(view.offsetY, height, viewportSize.height),
          };
        })()
      : null;

  const cursorClass = isPanning
    ? "cursor-grabbing"
    : isSpaceHeld
      ? "cursor-grab"
      : isDisabled
        ? "cursor-default"
        : "cursor-crosshair";

  return (
    <div
      ref={viewportRef}
      className={`relative h-[70vh] min-h-[420px] w-full touch-none overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-inner ${cursorClass}`}
      aria-label="평면도. 클릭하여 마커를 배치하고, 드래그로 이동하고, 휠로 확대·축소합니다."
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        ref={worldRef}
        className="absolute"
        style={world ? { left: world.left, top: world.top, width: world.width, height: world.height } : { inset: 0 }}
      >
        {/* 실제 실험 도면은 public/floor-plan-fp1.svg, floor-plan-fp2.svg 파일로 교체합니다. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG 원본 비율을 그대로 사용하며 이미지 최적화가 필요 없습니다. */}
        <img
          src={FLOOR_PLAN_IMAGES[floorPlan]}
          alt={`실험용 평면도 ${floorPlan}`}
          draggable={false}
          onLoad={handleImageLoad}
          className="pointer-events-none h-full w-full select-none"
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

      <div
        className="absolute right-3 top-3 z-30 flex flex-col gap-2"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="확대"
          onClick={() => handleZoomButton(BUTTON_ZOOM_FACTOR)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          +
        </button>
        <button
          type="button"
          aria-label="축소"
          onClick={() => handleZoomButton(1 / BUTTON_ZOOM_FACTOR)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          −
        </button>
        <button
          type="button"
          aria-label="전체 보기"
          onClick={handleResetView}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          전체
        </button>
      </div>
    </div>
  );
}
