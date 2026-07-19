-- 위치 응답을 가이드별로 저장하도록 확장합니다.
-- experiment_code는 이제 평면도(FP1/FP2)만 담고, 세션(S1~S3)은 제출 시점에 알 수 없어
-- session_number를 비워둔 뒤 관리자 페이지에서 매칭합니다. 대면 실험 날짜도 함께 저장합니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

alter table public.experiment_submissions
  add column if not exists experiment_date date,
  add column if not exists session_number text
    check (session_number is null or session_number in ('S1', 'S2', 'S3'));

create index if not exists experiment_submissions_experiment_date_idx
  on public.experiment_submissions (experiment_date);

-- experiment_date를 받는 새 RPC로 교체합니다(세션은 관리자가 나중에 채웁니다).
create or replace function public.record_experiment_submission(
  p_experiment_code text,
  p_participant_id text,
  p_experiment_date date,
  p_guide_type text,
  p_started_at timestamptz,
  p_submitted_at timestamptz,
  p_duration_ms integer,
  p_deleted_marker_count integer,
  p_markers jsonb,
  p_events jsonb
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

  insert into public.experiment_submissions (
    experiment_code,
    participant_id,
    experiment_date,
    guide_type,
    started_at,
    submitted_at,
    duration_ms,
    deleted_marker_count
  )
  values (
    p_experiment_code,
    p_participant_id,
    p_experiment_date,
    p_guide_type,
    p_started_at,
    p_submitted_at,
    p_duration_ms,
    p_deleted_marker_count
  )
  returning id into new_submission_id;

  insert into public.marker_responses (
    submission_id,
    marker_client_id,
    color,
    x,
    y,
    placed_at,
    move_count
  )
  select
    new_submission_id,
    marker.marker_client_id,
    marker.color,
    marker.x,
    marker.y,
    marker.placed_at,
    marker.move_count
  from jsonb_to_recordset(p_markers) as marker(
    marker_client_id uuid,
    color text,
    x double precision,
    y double precision,
    placed_at timestamptz,
    move_count integer
  );

  insert into public.experiment_events (
    submission_id,
    event_sequence,
    event_type,
    marker_client_id,
    color,
    x,
    y,
    occurred_at
  )
  select
    new_submission_id,
    event.event_sequence,
    event.event_type,
    event.marker_client_id,
    event.color,
    event.x,
    event.y,
    event.occurred_at
  from jsonb_to_recordset(p_events) as event(
    event_sequence integer,
    event_type text,
    marker_client_id uuid,
    color text,
    x double precision,
    y double precision,
    occurred_at timestamptz
  );

  return new_submission_id;
end;
$$;

revoke all on function public.record_experiment_submission(text, text, date, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) from public;
grant execute on function public.record_experiment_submission(text, text, date, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) to service_role;

-- experiment_date가 없던 이전 시그니처는 더 이상 호출하지 않으므로 제거합니다.
drop function if exists public.record_experiment_submission(text, text, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb);

-- 관리자가 세션을 매칭할 수 있도록 하나의 제출 세션 번호를 갱신하는 함수입니다.
create or replace function public.set_submission_session(
  p_submission_id uuid,
  p_session_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_number is not null and p_session_number not in ('S1', 'S2', 'S3') then
    raise exception 'Unsupported session number: %', p_session_number;
  end if;

  update public.experiment_submissions
  set session_number = p_session_number
  where id = p_submission_id;
end;
$$;

revoke all on function public.set_submission_session(uuid, text) from public;
grant execute on function public.set_submission_session(uuid, text) to service_role;
