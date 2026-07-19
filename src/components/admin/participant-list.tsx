"use client";

import { useState } from "react";

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

export function ParticipantList({ submissions }: ParticipantListProps) {
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
                제출 시각 (KST)
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                응답 시간
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                삭제 수
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
                <td className="whitespace-nowrap px-5 py-4">{formatDateTime(submission.submitted_at)}</td>
                <td className="whitespace-nowrap px-5 py-4">{formatDuration(submission.duration_ms)}</td>
                <td className="whitespace-nowrap px-5 py-4">{submission.deleted_marker_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
