import type { ExperimentSubmission } from "@/types/experiment";

interface SubmissionResponse {
  submissionId: string;
}

/** 참가자 브라우저에서 서버 API를 호출합니다. Supabase 키는 브라우저로 전송하지 않습니다. */
export async function submitExperiment(submission: ExperimentSubmission): Promise<SubmissionResponse> {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });

  const body = (await response.json().catch(() => null)) as { message?: string; submissionId?: string } | null;

  if (!response.ok || !body?.submissionId) {
    throw new Error(body?.message ?? "응답을 저장하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
  }

  return { submissionId: body.submissionId };
}
