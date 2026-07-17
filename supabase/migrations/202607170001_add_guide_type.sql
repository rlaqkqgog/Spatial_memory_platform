-- Record the guide condition experienced by each participant.
-- Existing submissions are preserved and marked as unspecified.

alter table public.experiment_submissions
  add column guide_type text not null default 'unspecified'
  check (guide_type in ('none', 'voice', 'visual', 'voice_visual', 'unspecified'));

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
  if p_guide_type not in ('none', 'voice', 'visual', 'voice_visual') then
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

-- The legacy overload is kept for migration compatibility but is no longer callable by the app role.
revoke execute on function public.record_experiment_submission(text, text, timestamptz, timestamptz, integer, integer, jsonb, jsonb) from service_role;

create or replace view public.admin_event_log
with (security_invoker = true)
as
select
  event.id as event_id,
  submission.participant_id,
  submission.experiment_code,
  event.submission_id,
  event.event_sequence,
  event.event_type,
  event.marker_client_id,
  event.color,
  event.x,
  event.y,
  event.occurred_at as participant_action_at,
  event.created_at as recorded_at,
  submission.submitted_at,
  submission.guide_type
from public.experiment_events as event
inner join public.experiment_submissions as submission
  on submission.id = event.submission_id;

revoke all on table public.admin_event_log from anon, authenticated;
grant select on table public.admin_event_log to service_role;
