import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getCurrentAdmin } from "@/lib/admin-session";

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-indigo-600">공간기억 연구</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">관리자 로그인</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          연구 관리자에게만 참가자 응답 목록이 표시됩니다.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
