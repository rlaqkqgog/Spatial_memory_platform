import { NextResponse } from "next/server";

import {
  type AagAnswerMarkerInput,
  isAagFloorPlanId,
  isAagMarkerColor,
  isAagSetId,
} from "@/lib/aag-answer-set";
import { getAagAnswerSet, replaceAagAnswerMarkers } from "@/lib/aag-answer-set-server";
import { getCurrentAdmin } from "@/lib/admin-session";

interface RouteContext {
  params: Promise<{ floorPlanId: string; setId: string }>;
}

interface SavePayload {
  markers?: unknown;
  seed?: unknown;
  generatorVersion?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_: Request, context: RouteContext) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const ids = await parseIds(context);
  if (!ids) return NextResponse.json({ message: "Unknown floor plan or set identifier." }, { status: 404 });

  try {
    const answerSet = await getAagAnswerSet(ids.floorPlanId, ids.setId);
    return answerSet
      ? NextResponse.json({ answerSet })
      : NextResponse.json({ message: "AAG answer set was not found." }, { status: 404 });
  } catch (error) {
    console.error("Unable to load AAG answer set", error);
    return NextResponse.json({ message: "AAG answer set could not be loaded." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ message: "Administrator authentication is required." }, { status: 401 });
  }

  const ids = await parseIds(context);
  if (!ids) return NextResponse.json({ message: "Unknown floor plan or set identifier." }, { status: 404 });

  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return NextResponse.json({ message: "The request body must be JSON." }, { status: 400 });
  }

  const parsed = parseSavePayload(body);
  if ("message" in parsed) return NextResponse.json(parsed, { status: 400 });

  try {
    const answerSet = await replaceAagAnswerMarkers(
      ids.floorPlanId,
      ids.setId,
      parsed.markers,
      parsed.seed,
      parsed.generatorVersion,
    );
    return NextResponse.json({ answerSet });
  } catch (error) {
    console.error("Unable to save AAG answer set", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "AAG answer set could not be saved." },
      { status: 409 },
    );
  }
}

async function parseIds(context: RouteContext) {
  const { floorPlanId, setId } = await context.params;
  return isAagFloorPlanId(floorPlanId) && isAagSetId(setId) ? { floorPlanId, setId } : null;
}

function parseSavePayload(payload: SavePayload):
  | { markers: AagAnswerMarkerInput[]; seed: string | null; generatorVersion: string | null }
  | { message: string } {
  if (!Array.isArray(payload.markers) || payload.markers.length > 12) {
    return { message: "A draft can contain up to 12 complete answer markers." };
  }

  const markers: AagAnswerMarkerInput[] = [];
  const markerIds = new Set<string>();
  const labels = new Set<string>();
  for (const [index, value] of payload.markers.entries()) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { message: `Marker ${index + 1} is not an object.` };
    }
    const marker = value as Record<string, unknown>;
    if (
      typeof marker.answerMarkerId !== "string" ||
      !UUID_PATTERN.test(marker.answerMarkerId) ||
      !isAagMarkerColor(marker.color) ||
      typeof marker.label !== "string" ||
      marker.label.trim().length === 0 ||
      marker.label.trim().length > 120 ||
      !isFiniteNumber(marker.worldX) ||
      !isFiniteNumber(marker.worldY) ||
      !isFiniteNumber(marker.worldZ) ||
      !isFiniteNumber(marker.planX) ||
      !isFiniteNumber(marker.planY) ||
      marker.planX < 0 ||
      marker.planX > 1 ||
      marker.planY < 0 ||
      marker.planY > 1
    ) {
      return { message: `Marker ${index + 1} has missing or invalid coordinates, color, label, or identifier.` };
    }
    if (markerIds.has(marker.answerMarkerId) || labels.has(marker.label.trim())) {
      return { message: "Each marker identifier and label must be unique within its set." };
    }

    markerIds.add(marker.answerMarkerId);
    labels.add(marker.label.trim());
    markers.push({
      answerMarkerId: marker.answerMarkerId,
      color: marker.color,
      label: marker.label.trim(),
      worldX: marker.worldX,
      worldY: marker.worldY,
      worldZ: marker.worldZ,
      planX: marker.planX,
      planY: marker.planY,
    });
  }

  const seed = parseOptionalText(payload.seed, "seed");
  if (typeof seed !== "string" && seed !== null) return seed;
  const generatorVersion = parseOptionalText(payload.generatorVersion, "generator version");
  if (typeof generatorVersion !== "string" && generatorVersion !== null) return generatorVersion;
  return { markers, seed, generatorVersion };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseOptionalText(value: unknown, name: string): string | null | { message: string } {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" && value.length <= 200
    ? value.trim() || null
    : { message: `The ${name} must be text up to 200 characters.` };
}
