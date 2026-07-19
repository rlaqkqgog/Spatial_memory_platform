import type { ExperimentSubmission, IncidentalSubmission } from "@/types/experiment";

interface SubmissionResponse {
  submissionId: string;
}

async function postSubmission(endpoint: string, payload: unknown): Promise<SubmissionResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as { message?: string; submissionId?: string } | null;

  if (!response.ok || !body?.submissionId) {
    throw new Error(body?.message ?? "응답을 저장하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
  }

  return { submissionId: body.submissionId };
}

/** 참가자 브라우저에서 서버 API를 호출합니다. Supabase 키는 브라우저로 전송하지 않습니다. */
export async function submitExperiment(submission: ExperimentSubmission): Promise<SubmissionResponse> {
  return postSubmission("/api/submissions", submission);
}

/** 본 응답 제출 후 우연객체 위치 응답을 저장합니다. */
export async function submitIncidental(submission: IncidentalSubmission): Promise<SubmissionResponse> {
  return postSubmission("/api/incidental-submissions", submission);
}
