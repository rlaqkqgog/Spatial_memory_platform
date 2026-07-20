"use client";

import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";

import type { AnswerKeySummary } from "@/lib/answer-key-server";
import { roomName } from "@/lib/room-names";
import { MARKER_COLORS, type MarkerColor } from "@/types/experiment";

const COLOR_DOT: Record<MarkerColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
};

const COLOR_LABEL: Record<MarkerColor, string> = {
  red: "빨강",
  blue: "파랑",
  green: "초록",
  yellow: "노랑",
};

function StoneBreakdown({ stones }: { stones: AnswerKeySummary["stones"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {MARKER_COLORS.map((color) => {
        const colorStones = stones.filter((stone) => stone.color === color);
        return (
          <div key={color} className="rounded-xl border border-slate-200 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span className={`h-3 w-3 rounded-full ${COLOR_DOT[color]}`} />
              {COLOR_LABEL[color]} ({colorStones.length})
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {colorStones.map((stone) => (
                <li key={stone.label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{roomName(stone.room_id)}</span>
                  <span className="tabular-nums text-slate-400">
                    ({stone.world_x.toFixed(1)}, {stone.world_z.toFixed(1)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

interface AnswerKeyManagerProps {
  answerKeys: AnswerKeySummary[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(
    new Date(value),
  );
}

export function AnswerKeyManager({ answerKeys }: AnswerKeyManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "success"; message: string }>({
    kind: "idle",
    message: "",
  });
  const [isUploading, setIsUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    setIsUploading(true);
    setStatus({ kind: "idle", message: "" });

    const results: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const csv = await file.text();
        const response = await fetch("/api/admin/answer-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv, filename: file.name }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { message?: string; participantId?: string; floorPlan?: string; sessionNumber?: string; stoneCount?: number }
          | null;
        if (!response.ok) {
          throw new Error(`${file.name}: ${payload?.message ?? "업로드 실패"}`);
        }
        results.push(
          `${payload?.participantId} · ${payload?.floorPlan}-${payload?.sessionNumber} · 정답 ${payload?.stoneCount}개`,
        );
      }
      setStatus({ kind: "success", message: `업로드 완료: ${results.join(" / ")}` });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`${label} 정답 세트를 삭제할까요?`)) {
      return;
    }
    const response = await fetch(`/api/admin/answer-keys/${id}`, { method: "DELETE" });
    if (response.ok) {
      router.refresh();
    } else {
      window.alert("삭제 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">정답 CSV 업로드</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          <code className="rounded bg-slate-100 px-1">spawned_object_answer_key.csv</code> 파일을 선택하세요. 파일 안의
          <code className="mx-1 rounded bg-slate-100 px-1">participantId</code>와
          <code className="mx-1 rounded bg-slate-100 px-1">setId</code>(예: FP1-S3)로 참가자·평면도·세션이 자동
          지정됩니다. 여러 파일을 한 번에 선택할 수 있고, 같은 조합은 재업로드 시 교체됩니다.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          disabled={isUploading}
          onChange={(event) => handleFiles(event.target.files)}
          className="mt-4 block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 disabled:opacity-50"
        />
        {status.kind !== "idle" ? (
          <p
            role={status.kind === "error" ? "alert" : "status"}
            className={`mt-3 rounded-xl px-4 py-3 text-sm ${
              status.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {status.message}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">업로드된 정답 세트</h2>
        </div>
        {answerKeys.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">아직 업로드된 정답 세트가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">참가자</th>
                  <th className="px-5 py-3 font-semibold">평면도-세션</th>
                  <th className="px-5 py-3 font-semibold">가이드</th>
                  <th className="px-5 py-3 font-semibold">정답 수</th>
                  <th className="px-5 py-3 font-semibold">파일</th>
                  <th className="px-5 py-3 font-semibold">업로드 시각</th>
                  <th className="px-5 py-3 font-semibold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {answerKeys.map((key) => (
                  <Fragment key={key.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-950">{key.participant_id}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {key.floor_plan}-{key.session_number}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{key.guide_mode ?? "-"}</td>
                      <td className="whitespace-nowrap px-5 py-3">{key.stone_count}</td>
                      <td className="max-w-[16rem] truncate px-5 py-3 text-slate-500">{key.source_filename ?? "-"}</td>
                      <td className="whitespace-nowrap px-5 py-3">{formatDateTime(key.created_at)}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId((current) => (current === key.id ? null : key.id))}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            {expandedId === key.id ? "방 접기" : "방 보기"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(key.id, `${key.participant_id} ${key.floor_plan}-${key.session_number}`)}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </span>
                      </td>
                    </tr>
                    {expandedId === key.id ? (
                      <tr className="bg-slate-50/60">
                        <td colSpan={7} className="px-5 py-4">
                          <StoneBreakdown stones={key.stones} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
