-- 원본 이벤트 로그에 참가자 정보를 결합한 관리자용 읽기 전용 뷰입니다.
-- 원본 event 테이블의 정규화 구조는 유지하면서 Table Editor에서 쉽게 검토할 수 있습니다.

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
  submission.submitted_at
from public.experiment_events as event
inner join public.experiment_submissions as submission
  on submission.id = event.submission_id;

revoke all on table public.admin_event_log from anon, authenticated;
grant select on table public.admin_event_log to service_role;
