"use client";

import { useRouter } from "next/navigation";

/** 이전 페이지로 돌아갑니다. 히스토리가 없으면(직접 접속 등) 사이트 홈으로 이동합니다. */
export function BackButton() {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      ← 뒤로가기
    </button>
  );
}
