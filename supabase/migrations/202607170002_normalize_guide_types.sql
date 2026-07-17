-- Normalize guide conditions to the research codes VG, AAG, and NG.
-- This migration follows 202607170001_add_guide_type.sql.

alter table public.experiment_submissions
  drop constraint if exists experiment_submissions_guide_type_check;

update public.experiment_submissions
set guide_type = case guide_type
  when 'visual' then 'VG'
  when 'voice' then 'AAG'
  when 'none' then 'NG'
  when 'voice_visual' then 'unspecified'
  else guide_type
end;

alter table public.experiment_submissions
  add constraint experiment_submissions_guide_type_check
  check (guide_type in ('VG', 'AAG', 'NG', 'unspecified'));

create or replace function public.record_experiment_submission(
  p_experiment_code text,
  p_participant_id text,
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
    guide_type,
    started_at,
    submitted_at,
    duration_ms,
    deleted_marker_count
  )
  values (
    p_experiment_code,
    p_participant_id,
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

revoke all on function public.record_experiment_submission(text, text, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) from public;
grant execute on function public.record_experiment_submission(text, text, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) to service_role;
