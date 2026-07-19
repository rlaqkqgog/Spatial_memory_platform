-- 우연객체 검사를 위치 회상에서 재인(봤음/못 봤음) 검사로 변경합니다.
-- 202607190001에서 만든 위치 회상 테이블은 테스트 데이터만 있으므로 제거합니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

drop function if exists public.record_incidental_submission(text, text, text, uuid, timestamptz, timestamptz, integer, integer, jsonb, jsonb);
drop table if exists public.incidental_events;
drop table if exists public.incidental_markers;
drop table if exists public.incidental_submissions;

create table public.incidental_recognition_submissions (
  id uuid primary key default gen_random_uuid(),
  experiment_code text not null check (char_length(trim(experiment_code)) between 1 and 100),
  participant_id text not null check (char_length(trim(participant_id)) between 2 and 100),
  guide_type text not null check (guide_type in ('VG', 'AAG', 'NG')),
  -- 같은 참가자·세션의 본 응답과 연결합니다.
  main_submission_id uuid references public.experiment_submissions(id) on delete set null,
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  check (submitted_at >= started_at)
);

create table public.incidental_recognition_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.incidental_recognition_submissions(id) on delete cascade,
  -- 화면에 표시된 순서(1부터)입니다.
  display_order integer not null check (display_order > 0),
  object_id text not null check (char_length(trim(object_id)) between 1 and 200),
  -- 참가자가 "봤음"을 선택했으면 true입니다.
  seen boolean not null,
  -- 해당 세션에 실제로 배치되었던 객체인지(정답)입니다. 제출 시점의 목록 기준으로 저장합니다.
  was_present boolean not null,
  -- 마지막으로 답을 선택(또는 변경)한 시각과 변경 횟수입니다.
  answered_at timestamptz not null,
  change_count integer not null default 0 check (change_count >= 0),
  created_at timestamptz not null default now(),
  unique (submission_id, object_id),
  unique (submission_id, display_order)
);

create index incidental_recognition_submissions_experiment_code_idx on public.incidental_recognition_submissions (experiment_code);
create index incidental_recognition_submissions_main_submission_id_idx on public.incidental_recognition_submissions (main_submission_id);
create index incidental_recognition_responses_submission_id_idx on public.incidental_recognition_responses (submission_id);

-- 한 번의 RPC 호출로 제출·응답을 하나의 트랜잭션으로 저장합니다.
create or replace function public.record_incidental_recognition(
  p_experiment_code text,
  p_participant_id text,
  p_guide_type text,
  p_main_submission_id uuid,
  p_started_at timestamptz,
  p_submitted_at timestamptz,
  p_duration_ms integer,
  p_responses jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_submission_id uuid;
begin
  if p_guide_type not in ('VG', 'AAG', 'NG') then
    raise exception 'Unsupported guide type: %', p_guide_type;
  end if;

  insert into public.incidental_recognition_submissions (
    experiment_code,
    participant_id,
    guide_type,
    main_submission_id,
    started_at,
    submitted_at,
    duration_ms
  )
  values (
    p_experiment_code,
    p_participant_id,
    p_guide_type,
    p_main_submission_id,
    p_started_at,
    p_submitted_at,
    p_duration_ms
  )
  returning id into new_submission_id;

  insert into public.incidental_recognition_responses (
    submission_id,
    display_order,
    object_id,
    seen,
    was_present,
    answered_at,
    change_count
  )
  select
    new_submission_id,
    response.display_order,
    response.object_id,
    response.seen,
    response.was_present,
    response.answered_at,
    response.change_count
  from jsonb_to_recordset(p_responses) as response(
    display_order integer,
    object_id text,
    seen boolean,
    was_present boolean,
    answered_at timestamptz,
    change_count integer
  );

  return new_submission_id;
end;
$$;

-- 브라우저는 DB에 직접 접근하지 않고, 서버의 service_role만 이 함수를 실행합니다.
alter table public.incidental_recognition_submissions enable row level security;
alter table public.incidental_recognition_responses enable row level security;

revoke all on table public.incidental_recognition_submissions, public.incidental_recognition_responses from anon, authenticated;
revoke all on function public.record_incidental_recognition(text, text, text, uuid, timestamptz, timestamptz, integer, jsonb) from public;
grant execute on function public.record_incidental_recognition(text, text, text, uuid, timestamptz, timestamptz, integer, jsonb) to service_role;
