-- 우연객체(incidental object) 위치 회상 응답 저장 스키마입니다.
-- 본 응답(experiment_submissions) 제출 직후 이어지는 2단계 응답을 별도 테이블에 저장합니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create table public.incidental_submissions (
  id uuid primary key default gen_random_uuid(),
  experiment_code text not null check (char_length(trim(experiment_code)) between 1 and 100),
  participant_id text not null check (char_length(trim(participant_id)) between 2 and 100),
  guide_type text not null check (guide_type in ('VG', 'AAG', 'NG')),
  -- 같은 참가자·세션의 본 응답과 연결합니다.
  main_submission_id uuid references public.experiment_submissions(id) on delete set null,
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  deleted_marker_count integer not null default 0 check (deleted_marker_count >= 0),
  created_at timestamptz not null default now(),
  check (submitted_at >= started_at)
);

create table public.incidental_markers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.incidental_submissions(id) on delete cascade,
  marker_client_id uuid not null,
  object_id text not null check (char_length(trim(object_id)) between 1 and 200),
  x double precision not null check (x between 0 and 1),
  y double precision not null check (y between 0 and 1),
  placed_at timestamptz not null,
  move_count integer not null default 0 check (move_count >= 0),
  created_at timestamptz not null default now(),
  unique (submission_id, marker_client_id),
  unique (submission_id, object_id)
);

create table public.incidental_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.incidental_submissions(id) on delete cascade,
  event_sequence integer not null check (event_sequence > 0),
  event_type text not null check (event_type in ('start', 'object_select', 'marker_place', 'marker_move', 'marker_delete', 'submit')),
  marker_client_id uuid,
  object_id text,
  x double precision check (x is null or x between 0 and 1),
  y double precision check (y is null or y between 0 and 1),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (submission_id, event_sequence)
);

create index incidental_submissions_experiment_code_idx on public.incidental_submissions (experiment_code);
create index incidental_submissions_main_submission_id_idx on public.incidental_submissions (main_submission_id);
create index incidental_markers_submission_id_idx on public.incidental_markers (submission_id);
create index incidental_events_submission_id_idx on public.incidental_events (submission_id);

-- 한 번의 RPC 호출로 제출·마커·이벤트를 하나의 트랜잭션으로 저장합니다.
create or replace function public.record_incidental_submission(
  p_experiment_code text,
  p_participant_id text,
  p_guide_type text,
  p_main_submission_id uuid,
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

  insert into public.incidental_submissions (
    experiment_code,
    participant_id,
    guide_type,
    main_submission_id,
    started_at,
    submitted_at,
    duration_ms,
    deleted_marker_count
  )
  values (
    p_experiment_code,
    p_participant_id,
    p_guide_type,
    p_main_submission_id,
    p_started_at,
    p_submitted_at,
    p_duration_ms,
    p_deleted_marker_count
  )
  returning id into new_submission_id;

  insert into public.incidental_markers (
    submission_id,
    marker_client_id,
    object_id,
    x,
    y,
    placed_at,
    move_count
  )
  select
    new_submission_id,
    marker.marker_client_id,
    marker.object_id,
    marker.x,
    marker.y,
    marker.placed_at,
    marker.move_count
  from jsonb_to_recordset(p_markers) as marker(
    marker_client_id uuid,
    object_id text,
    x double precision,
    y double precision,
    placed_at timestamptz,
    move_count integer
  );

  insert into public.incidental_events (
    submission_id,
    event_sequence,
    event_type,
    marker_client_id,
    object_id,
    x,
    y,
    occurred_at
  )
  select
    new_submission_id,
    event.event_sequence,
    event.event_type,
    event.marker_client_id,
    event.object_id,
    event.x,
    event.y,
    event.occurred_at
  from jsonb_to_recordset(p_events) as event(
    event_sequence integer,
    event_type text,
    marker_client_id uuid,
    object_id text,
    x double precision,
    y double precision,
    occurred_at timestamptz
  );

  return new_submission_id;
end;
$$;

-- 브라우저는 DB에 직접 접근하지 않고, 서버의 service_role만 이 함수를 실행합니다.
alter table public.incidental_submissions enable row level security;
alter table public.incidental_markers enable row level security;
alter table public.incidental_events enable row level security;

revoke all on table public.incidental_submissions, public.incidental_markers, public.incidental_events from anon, authenticated;
revoke all on function public.record_incidental_submission(text, text, text, uuid, timestamptz, timestamptz, integer, integer, jsonb, jsonb) from public;
grant execute on function public.record_incidental_submission(text, text, text, uuid, timestamptz, timestamptz, integer, integer, jsonb, jsonb) to service_role;
