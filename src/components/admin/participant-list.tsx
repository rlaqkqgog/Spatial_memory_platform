import { GUIDE_TYPE_LABELS, type GuideType } from "@/types/experiment";

interface SubmissionRow {
  id: string;
  participant_id: string;
  experiment_code: string;
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
                참가자 ID
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                실험 조건
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                가이드 유형
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
                <td className="whitespace-nowrap px-5 py-4">{submission.experiment_code}</td>
                <td className="whitespace-nowrap px-5 py-4">
                  {submission.guide_type === "unspecified" ? "미기록" : GUIDE_TYPE_LABELS[submission.guide_type]}
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
