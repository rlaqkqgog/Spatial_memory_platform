-- 관리자 URL 접근이 허용된 Supabase Auth 사용자 목록입니다.
-- 이 파일을 초기 스키마 다음으로 Supabase SQL Editor에서 한 번 실행하세요.

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- 관리자 목록은 브라우저에서 직접 조회하거나 수정할 수 없습니다.
revoke all on table public.admin_users from anon, authenticated;
