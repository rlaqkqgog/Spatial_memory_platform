-- 우연객체 재인 응답의 정답/오답을 관리자가 수동으로 덮어쓸 수 있게 합니다.
-- manual_correct 가 null 이면 자동 채점(seen = was_present)을 사용하고,
-- true/false 이면 그 값으로 정답 여부를 강제합니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

alter table public.incidental_recognition_responses
  add column if not exists manual_correct boolean;

alter table public.incidental_recognition_responses
  add column if not exists manual_graded_at timestamptz;

comment on column public.incidental_recognition_responses.manual_correct is
  '관리자 수동 채점 값. null이면 자동 채점(seen = was_present)을 사용합니다.';
