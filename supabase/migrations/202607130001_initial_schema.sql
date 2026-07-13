-- 공간기억 실험 응답 저장을 위한 초기 스키마입니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create extension if not exists pgcrypto;

create table public.experiment_submissions (
  id uuid primary key default gen_random_uuid(),
  experiment_code text not null default 'default' check (char_length(trim(experiment_code)) between 1 and 100),
  participant_id text not null check (char_length(trim(participant_id)) between 2 and 100),
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  deleted_marker_count integer not null default 0 check (deleted_marker_count >= 0),
  created_at timestamptz not null default now(),
  check (submitted_at >= started_at)
);

create table public.marker_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.experiment_submissions(id) on delete cascade,
  marker_client_id uuid not null,
  color text not null check (color in ('red', 'blue', 'green', 'yellow')),
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  placed_at timestamptz not null,
  move_count integer not null default 0 check (move_count >= 0),
  created_at timestamptz not null default now(),
  unique (submission_id, marker_client_id)
);

create table public.experiment_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.experiment_submissions(id) on delete cascade,
  event_sequence integer not null check (event_sequence > 0),
  event_type text not null check (event_type in ('start', 'color_select', 'marker_place', 'marker_move', 'marker_delete', 'submit')),
  marker_client_id uuid,
  color text check (color is null or color in ('red', 'blue', 'green', 'yellow')),
  x double precision check (x is null or x between 0 and 1),
  y double precision check (y is null or y between 0 and 1),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (submission_id, event_sequence)
);

create index experiment_submissions_experiment_code_idx on public.experiment_submissions (experiment_code);
create index marker_responses_submission_id_idx on public.marker_responses (submission_id);
create index experiment_events_submission_id_idx on public.experiment_events (submission_id);

-- 한 번의 RPC 호출로 제출·마커·이벤트를 하나의 트랜잭션으로 저장합니다.
create or replace function public.record_experiment_submission(
  p_experiment_code text,
  p_participant_id text,
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
  insert into public.experiment_submissions (
    experiment_code,
    participant_id,
    started_at,
    submitted_at,
    duration_ms,
    deleted_marker_count
  )
  values (
    p_experiment_code,
    p_participant_id,
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

-- 브라우저는 DB에 직접 접근하지 않고, 서버의 service_role만 이 함수를 실행합니다.
alter table public.experiment_submissions enable row level security;
alter table public.marker_responses enable row level security;
alter table public.experiment_events enable row level security;

revoke all on table public.experiment_submissions, public.marker_responses, public.experiment_events from anon, authenticated;
revoke all on function public.record_experiment_submission(text, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) from public;
grant execute on function public.record_experiment_submission(text, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) to service_role;
