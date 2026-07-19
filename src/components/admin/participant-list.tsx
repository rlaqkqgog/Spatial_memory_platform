"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SubmissionScore } from "@/lib/answer-key-server";
import { GUIDE_TYPE_LABELS, SESSION_NUMBERS, type GuideType, type SessionNumber } from "@/types/experiment";

interface SubmissionRow {
  id: string;
  participant_id: string;
  experiment_code: string;
  experiment_date: string | null;
  session_number: SessionNumber | null;
  guide_type: GuideType | "unspecified";
  started_at: string;
  submitted_at: string;
  duration_ms: number;
  deleted_marker_count: number;
}

interface ParticipantListProps {
  submissions: SubmissionRow[];
  scores: Record<string, SubmissionScore>;
}

const SCORE_STATUS_LABEL: Record<Exclude<SubmissionScore["status"], "scored">, string> = {
  no_session: "세션 미지정",
  no_answer_key: "정답 없음",
  no_calibration: "캘리브레이션 없음",
};

function ScoreCell({ score }: { score: SubmissionScore | undefined }) {
  if (!score) {
    return <span className="text-xs text-slate-400">-</span>;
  }
  if (score.status !== "scored") {
    return <span className="text-xs text-slate-400">{SCORE_STATUS_LABEL[score.status]}</span>;
  }
  const accuracyPercent = Math.round((score.accuracy ?? 0) * 100);
  return (
    <span className="flex flex-col">
      <span className="font-semibold text-slate-900">
        {accuracyPercent}%
        <span className="ml-1 text-xs font-normal text-slate-500">
          ({score.withinThreshold}/{score.totalMarkers}, ≤{score.thresholdMeters}m)
        </span>
      </span>
      <span className="text-xs text-slate-500">평균 {score.meanErrorMeters?.toFixed(2)}m</span>
    </span>
  );
}

/** 하나의 응답(위치 + 연결된 우연객체)을 삭제하는 버튼입니다. */
function DeleteButton({ submissionId, participantId, onDeleted }: { submissionId: string; participantId: string; onDeleted: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`${participantId}의 이 응답과 연결된 우연객체 응답을 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("failed");
      }
      onDeleted();
    } catch {
      setIsDeleting(false);
      window.alert("삭제 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <button
      type="button"
      disabled={isDeleting}
      onClick={handleDelete}
      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isDeleting ? "삭제 중…" : "삭제"}
    </button>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${seconds}초`;
}

/** 세션을 관리자가 수동으로 매칭하는 드롭다운입니다. 저장은 서버 API를 통해 이뤄집니다. */
function SessionMatcher({ submissionId, initial }: { submissionId: string; initial: SessionNumber | null }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionNumber | "">(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleChange(next: SessionNumber | "") {
    const previous = session;
    setSession(next);
    setStatus("saving");
    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionNumber: next === "" ? null : next }),
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      setStatus("saved");
      // 세션이 바뀌면 정답률을 다시 계산하도록 서버 데이터를 새로고침합니다.
      router.refresh();
    } catch {
      setSession(previous);
      setStatus("error");
    }
  }

  return (
    <span className="flex items-center gap-2">
      <select
        aria-label="세션 매칭"
        value={session}
        onChange={(event) => handleChange(event.target.value as SessionNumber | "")}
        className={`rounded-lg border bg-white px-2 py-1 text-sm outline-none transition focus:ring-2 ${
          session ? "border-slate-300 text-slate-900" : "border-amber-300 bg-amber-50 text-amber-700"
        }`}
      >
        <option value="">미지정</option>
        {SESSION_NUMBERS.map((sessionNumber) => (
          <option key={sessionNumber} value={sessionNumber}>
            {sessionNumber}
          </option>
        ))}
      </select>
      {status === "saving" ? <span className="text-xs text-slate-400">저장 중…</span> : null}
      {status === "saved" ? <span className="text-xs text-emerald-600">저장됨</span> : null}
      {status === "error" ? <span className="text-xs text-red-600">오류</span> : null}
    </span>
  );
}

export function ParticipantList({ submissions: initialSubmissions, scores }: ParticipantListProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);

  if (submissions.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">아직 제출된 응답이 없습니다.</h2>
        <p className="mt-2 text-sm text-slate-600">참가자가 제출을 완료하면 이 목록에 표시됩니다.</p>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-5 py-4 font-semibold">
                참가자
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                실험 날짜
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                평면도
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                가이드 유형
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                세션 매칭
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                정답률 (거리)
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                제출 시각 (KST)
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                응답 시간
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                삭제 수
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {submissions.map((submission) => (
              <tr key={submission.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">{submission.participant_id}</td>
                <td className="whitespace-nowrap px-5 py-4">{submission.experiment_date ?? "-"}</td>
                <td className="whitespace-nowrap px-5 py-4">{submission.experiment_code}</td>
                <td className="whitespace-nowrap px-5 py-4">
                  {submission.guide_type === "unspecified" ? "미기록" : GUIDE_TYPE_LABELS[submission.guide_type]}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <SessionMatcher submissionId={submission.id} initial={submission.session_number} />
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <ScoreCell score={scores[submission.id]} />
                </td>
                <td className="whitespace-nowrap px-5 py-4">{formatDateTime(submission.submitted_at)}</td>
                <td className="whitespace-nowrap px-5 py-4">{formatDuration(submission.duration_ms)}</td>
                <td className="whitespace-nowrap px-5 py-4">{submission.deleted_marker_count}</td>
                <td className="whitespace-nowrap px-5 py-4">
                  <DeleteButton
                    submissionId={submission.id}
                    participantId={submission.participant_id}
                    onDeleted={() => setSubmissions((rows) => rows.filter((row) => row.id !== submission.id))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
