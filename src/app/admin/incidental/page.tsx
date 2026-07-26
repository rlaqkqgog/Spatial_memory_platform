import Link from "next/link";
import { redirect } from "next/navigation";

import { IncidentalList } from "@/components/admin/incidental-list";
import { getCurrentAdmin } from "@/lib/admin-session";
import { listIncidentalRecognitions, type IncidentalSubmissionSummary } from "@/lib/incidental-server";

export const dynamic = "force-dynamic";

export default async function IncidentalPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  let submissions: IncidentalSubmissionSummary[] = [];
  let loadError: string | null = null;
  try {
    submissions = await listIncidentalRecognitions();
  } catch (error) {
    // 어떤 마이그레이션이 빠졌는지 알 수 있도록 원본 메시지를 남기고 화면에도 보여 줍니다.
    loadError = error instanceof Error ? error.message : String(error);
    console.error("[admin/incidental] 재인 응답 조회 실패:", error);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">우연객체 재인 응답</h1>
            <p className="mt-2 text-sm text-slate-600">
              세션별 객체를 &ldquo;봤음/못봤음&rdquo;으로 답한 재인 검사 결과입니다. 실제 배치 여부와 비교해 정답률을 계산합니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* API 라우트에서 파일을 내려받는 링크이므로 next/link가 아니라 a 태그를 사용합니다. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/admin/incidental/csv"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              전체 CSV 다운로드
            </a>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              참가자 목록
            </Link>
          </div>
        </header>

        {loadError ? (
          <section role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            <p>
              우연객체 응답을 불러오지 못했습니다. <code>supabase/migrations</code>의{" "}
              <code>202607190002_incidental_recognition.sql</code>과{" "}
              <code>202607200002_incidental_manual_grade.sql</code>이 순서대로 적용되었는지 확인해 주세요.
            </p>
            <p className="mt-2 break-words font-mono text-xs text-red-600">{loadError}</p>
          </section>
        ) : (
          <IncidentalList submissions={submissions} />
        )}
      </div>
    </main>
  );
}
