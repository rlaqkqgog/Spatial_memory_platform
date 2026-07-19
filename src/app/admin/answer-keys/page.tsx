import Link from "next/link";
import { redirect } from "next/navigation";

import { AnswerKeyManager } from "@/components/admin/answer-key-manager";
import { listAnswerKeys, type AnswerKeySummary } from "@/lib/answer-key-server";
import { getCurrentAdmin } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AnswerKeysPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  let answerKeys: AnswerKeySummary[] = [];
  let loadError = false;
  try {
    answerKeys = await listAnswerKeys();
  } catch {
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">정답 세트 관리</h1>
            <p className="mt-2 text-sm text-slate-600">참가자·세션별 정답 CSV를 업로드하고 관리합니다.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/calibration"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              평면도 캘리브레이션
            </Link>
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
            정답 세트를 불러오지 못했습니다. migration 202607190004가 적용되었는지 확인해 주세요.
          </section>
        ) : (
          <AnswerKeyManager answerKeys={answerKeys} />
        )}
      </div>
    </main>
  );
}
