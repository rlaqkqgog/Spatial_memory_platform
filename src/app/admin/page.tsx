import { redirect } from "next/navigation";

import { ParticipantList } from "@/components/admin/participant-list";
import { getCurrentAdmin } from "@/lib/admin-session";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

interface SubmissionRow {
  id: string;
  participant_id: string;
  experiment_code: string;
  started_at: string;
  submitted_at: string;
  duration_ms: number;
  deleted_marker_count: number;
}

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("experiment_submissions")
    .select("id, participant_id, experiment_code, started_at, submitted_at, duration_ms, deleted_marker_count")
    .order("submitted_at", { ascending: false });

  const submissions = (data ?? []) as SubmissionRow[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">참가자 응답 목록</h1>
            <p className="mt-2 text-sm text-slate-600">제출이 완료된 응답만 표시합니다.</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-600">{admin.email}</p>
            <form action="/api/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                로그아웃
              </button>
            </form>
          </div>
        </header>

        {error ? (
          <section role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            참가자 목록을 불러오지 못했습니다. Supabase 설정과 관리자 권한을 확인해 주세요.
          </section>
        ) : (
          <ParticipantList submissions={submissions} />
        )}
      </div>
    </main>
  );
}
