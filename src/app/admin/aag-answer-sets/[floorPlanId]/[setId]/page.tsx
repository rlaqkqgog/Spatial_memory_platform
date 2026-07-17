import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AagAnswerSetEditor } from "@/components/admin/aag-answer-set-editor";
import { isAagFloorPlanId, isAagSetId } from "@/lib/aag-answer-set";
import { getAagAnswerSet } from "@/lib/aag-answer-set-server";
import { getCurrentAdmin } from "@/lib/admin-session";

interface PageProps {
  params: Promise<{ floorPlanId: string; setId: string }>;
}

export default async function AagAnswerSetPage({ params }: PageProps) {
  if (!(await getCurrentAdmin())) redirect("/admin/login");

  const { floorPlanId, setId } = await params;
  if (!isAagFloorPlanId(floorPlanId) || !isAagSetId(setId)) notFound();

  const answerSet = await getAagAnswerSet(floorPlanId, setId);
  if (!answerSet) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/aag-answer-sets" className="text-sm font-semibold text-indigo-700">← AAG 정답 세트 목록</Link>
        <div className="mt-4"><AagAnswerSetEditor answerSet={answerSet} /></div>
      </div>
    </main>
  );
}
