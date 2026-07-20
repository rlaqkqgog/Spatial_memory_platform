"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import type { IncidentalResponseRow, IncidentalSubmissionSummary } from "@/lib/incidental-server";
import { GUIDE_TYPE_LABELS } from "@/types/experiment";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Seoul" }).format(
    new Date(value),
  );
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${seconds}초`;
}

/** 실제 적용 중인 정답 판정 라벨입니다. 수동으로 덮어썼으면 "수동" 표시를 붙입니다. */
function verdict(response: IncidentalResponseRow): { label: string; className: string } {
  const basis = response.was_present
    ? response.seen
      ? "배치·봤음"
      : "배치·못봤음"
    : response.seen
      ? "미출현·봤음"
      : "미출현·못봤음";
  const manual = response.manual_correct !== null ? " · 수동" : "";
  return {
    label: `${response.correct ? "정답" : "오답"} (${basis})${manual}`,
    className: response.correct ? "text-emerald-700" : "text-red-600",
  };
}

/** 자동 / 정답 / 오답 3단계 수동 채점 컨트롤입니다. */
function GradeControl({ response }: { response: IncidentalResponseRow }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(false);

  const value = response.manual_correct === null ? "auto" : response.manual_correct ? "correct" : "incorrect";

  async function handleChange(next: string) {
    const manualCorrect = next === "auto" ? null : next === "correct";
    setIsSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/incidental/responses/${response.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualCorrect }),
      });
      if (!res.ok) {
        throw new Error("failed");
      }
      // 서버에서 정답률·집계를 다시 계산하도록 데이터를 새로고침합니다.
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <select
        aria-label={`${response.label} 수동 채점`}
        value={value}
        disabled={isSaving}
        onChange={(event) => handleChange(event.target.value)}
        className={`rounded-lg border px-2 py-1 text-xs outline-none transition focus:ring-2 disabled:opacity-50 ${
          response.manual_correct !== null ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-slate-300 text-slate-700"
        }`}
      >
        <option value="auto">자동</option>
        <option value="correct">정답</option>
        <option value="incorrect">오답</option>
      </select>
      {isSaving ? <span className="text-xs text-slate-400">저장 중…</span> : null}
      {error ? <span className="text-xs text-red-600">오류</span> : null}
    </span>
  );
}

function ResponseBreakdown({ responses }: { responses: IncidentalResponseRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">객체</th>
            <th className="px-3 py-2 font-semibold">실제 배치</th>
            <th className="px-3 py-2 font-semibold">참가자 응답</th>
            <th className="px-3 py-2 font-semibold">판정</th>
            <th className="px-3 py-2 font-semibold">수동 채점</th>
            <th className="px-3 py-2 font-semibold">변경 횟수</th>
            <th className="px-3 py-2 font-semibold">응답 시각</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {responses.map((response) => {
            const decision = verdict(response);
            return (
              <tr key={response.object_id}>
                <td className="px-3 py-2 tabular-nums text-slate-400">{response.display_order}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{response.label}</td>
                <td className="px-3 py-2">{response.was_present ? "배치됨" : "미출현"}</td>
                <td className="px-3 py-2">{response.seen ? "봤음" : "못봤음"}</td>
                <td className={`px-3 py-2 font-semibold ${decision.className}`}>{decision.label}</td>
                <td className="px-3 py-2">
                  <GradeControl response={response} />
                </td>
                <td className="px-3 py-2 tabular-nums">{response.change_count}</td>
                <td className="px-3 py-2 text-slate-500">{formatDateTime(response.answered_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">
        수동 채점을 &ldquo;정답/오답&rdquo;으로 바꾸면 해당 응답의 판정을 덮어쓰고 정답률이 다시 계산됩니다. &ldquo;자동&rdquo;은 참가자 응답과 실제 배치를 비교한 기본 채점입니다.
      </p>
    </div>
  );
}

interface IncidentalListProps {
  submissions: IncidentalSubmissionSummary[];
}

export function IncidentalList({ submissions }: IncidentalListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (submissions.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">아직 제출된 우연객체 응답이 없습니다.</h2>
        <p className="mt-2 text-sm text-slate-600">참가자가 재인 검사를 완료하면 이 목록에 표시됩니다.</p>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-5 py-3 font-semibold">참가자</th>
              <th className="px-5 py-3 font-semibold">세션</th>
              <th className="px-5 py-3 font-semibold">가이드</th>
              <th className="px-5 py-3 font-semibold">정답률</th>
              <th className="px-5 py-3 font-semibold">적중/오경보</th>
              <th className="px-5 py-3 font-semibold">제출 시각 (KST)</th>
              <th className="px-5 py-3 font-semibold">응답 시간</th>
              <th className="px-5 py-3 font-semibold">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {submissions.map((submission) => {
              const accuracyPercent = Math.round(submission.accuracy * 100);
              return (
                <Fragment key={submission.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-950">
                      {submission.participant_id}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">{submission.experiment_code}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {submission.guide_type ? GUIDE_TYPE_LABELS[submission.guide_type] : "미기록"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="font-semibold text-slate-900">{accuracyPercent}%</span>
                      <span className="ml-1 text-xs text-slate-500">
                        ({submission.correctCount}/{submission.totalCount})
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600">
                      적중 {submission.hitCount}/{submission.presentCount} · 오경보 {submission.falseAlarmCount}/
                      {submission.absentCount}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDateTime(submission.submitted_at)}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDuration(submission.duration_ms)}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId((current) => (current === submission.id ? null : submission.id))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {expandedId === submission.id ? "접기" : "응답 보기"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === submission.id ? (
                    <tr className="bg-slate-50/60">
                      <td colSpan={8} className="px-5 py-4">
                        <ResponseBreakdown responses={submission.responses} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
