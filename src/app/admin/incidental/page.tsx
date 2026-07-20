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
  let loadError = false;
  try {
    submissions = await listIncidentalRecognitions();
  } catch {
    loadError = true;
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
            우연객체 응답을 불러오지 못했습니다. migration 202607190002가 적용되었는지 확인해 주세요.
          </section>
        ) : (
          <IncidentalList submissions={submissions} />
        )}
      </div>
    </main>
  );
}
