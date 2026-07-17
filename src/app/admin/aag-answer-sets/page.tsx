import Link from "next/link";
import { redirect } from "next/navigation";

import { listAagAnswerSets } from "@/lib/aag-answer-set-server";
import { getCurrentAdmin } from "@/lib/admin-session";

export default async function AagAnswerSetsPage() {
  if (!(await getCurrentAdmin())) redirect("/admin/login");

  let answerSets: Awaited<ReturnType<typeof listAagAnswerSets>>;
  try {
    answerSets = await listAagAnswerSets();
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-950">AAG 정답 세트</h1>
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">정답 세트를 불러오지 못했습니다. `202607140001_aag_answer_sets.sql` migration이 적용되었는지 확인해 주세요.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm font-semibold text-indigo-700">← 관리자 홈</Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">AAG 오브젝트 배치 정답 세트</h1>
        <p className="mt-2 text-sm text-slate-600">FP1/FP2의 6개 세트에 실제 MRUK 좌표와 평면도 좌표를 입력합니다. 빈 세트는 draft이며, 임의 좌표는 생성하지 않습니다.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {answerSets.map((answerSet) => (
            <Link key={`${answerSet.floorPlanId}-${answerSet.setId}`} href={`/admin/aag-answer-sets/${answerSet.floorPlanId}/${answerSet.setId}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow">
              <div className="flex items-center justify-between"><h2 className="font-bold text-slate-950">{answerSet.floorPlanId}-{answerSet.setId}</h2><span className={`rounded-full px-2 py-1 text-xs font-semibold ${answerSet.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{answerSet.status}</span></div>
              <p className="mt-4 text-sm text-slate-700">{answerSet.validation.markerCount} / 12 markers</p>
              <p className="mt-1 text-sm text-slate-600">R {answerSet.validation.colorCounts.red} · B {answerSet.validation.colorCounts.blue} · G {answerSet.validation.colorCounts.green} · Y {answerSet.validation.colorCounts.yellow}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
