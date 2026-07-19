-- 정답 세트(spawned_object_answer_key.csv) 업로드와 평면도 캘리브레이션 저장 스키마입니다.
-- 정답 좌표는 Unity 월드 좌표(미터)이고, 참가자 응답은 평면도 정규화 좌표(0~1)입니다.
-- 평면도별 기준점(reference points)으로 두 좌표계를 잇는 아핀 변환을 계산해 채점합니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

create table public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null check (char_length(trim(participant_id)) between 1 and 100),
  floor_plan text not null check (floor_plan in ('FP1', 'FP2')),
  session_number text not null check (session_number in ('S1', 'S2', 'S3')),
  set_id text not null,
  guide_mode text,
  source_filename text,
  created_at timestamptz not null default now(),
  -- 참가자·평면도·세션 조합마다 정답 세트는 하나입니다(재업로드 시 교체).
  unique (participant_id, floor_plan, session_number)
);

create table public.answer_key_stones (
  id uuid primary key default gen_random_uuid(),
  answer_key_id uuid not null references public.answer_keys(id) on delete cascade,
  color text not null check (color in ('red', 'blue', 'green', 'yellow')),
  label text not null,
  world_x double precision not null,
  world_y double precision,
  world_z double precision not null,
  room_id text,
  source_mode text,
  created_at timestamptz not null default now()
);

create index answer_key_stones_answer_key_id_idx on public.answer_key_stones (answer_key_id);
create index answer_keys_lookup_idx on public.answer_keys (participant_id, floor_plan, session_number);

-- 평면도별 캘리브레이션 기준점입니다.
-- reference_points: [{ "plan_x": 0~1, "plan_y": 0~1, "world_x": m, "world_z": m }, ...] (3개 이상 권장)
create table public.floor_plan_calibrations (
  floor_plan text primary key check (floor_plan in ('FP1', 'FP2')),
  reference_points jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 정답 세트를 트랜잭션으로 교체 저장합니다.
create or replace function public.record_answer_key(
  p_participant_id text,
  p_floor_plan text,
  p_session_number text,
  p_set_id text,
  p_guide_mode text,
  p_source_filename text,
  p_stones jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_answer_key_id uuid;
begin
  if p_floor_plan not in ('FP1', 'FP2') then
    raise exception 'Unsupported floor plan: %', p_floor_plan;
  end if;
  if p_session_number not in ('S1', 'S2', 'S3') then
    raise exception 'Unsupported session number: %', p_session_number;
  end if;

  delete from public.answer_keys
  where participant_id = p_participant_id and floor_plan = p_floor_plan and session_number = p_session_number;

  insert into public.answer_keys (participant_id, floor_plan, session_number, set_id, guide_mode, source_filename)
  values (p_participant_id, p_floor_plan, p_session_number, p_set_id, p_guide_mode, p_source_filename)
  returning id into new_answer_key_id;

  insert into public.answer_key_stones (
    answer_key_id, color, label, world_x, world_y, world_z, room_id, source_mode
  )
  select
    new_answer_key_id, stone.color, stone.label, stone.world_x, stone.world_y, stone.world_z, stone.room_id, stone.source_mode
  from jsonb_to_recordset(p_stones) as stone(
    color text, label text, world_x double precision, world_y double precision, world_z double precision, room_id text, source_mode text
  );

  return new_answer_key_id;
end;
$$;

create or replace function public.set_floor_plan_calibration(
  p_floor_plan text,
  p_reference_points jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_floor_plan not in ('FP1', 'FP2') then
    raise exception 'Unsupported floor plan: %', p_floor_plan;
  end if;

  insert into public.floor_plan_calibrations (floor_plan, reference_points, updated_at)
  values (p_floor_plan, p_reference_points, now())
  on conflict (floor_plan)
  do update set reference_points = excluded.reference_points, updated_at = now();
end;
$$;

alter table public.answer_keys enable row level security;
alter table public.answer_key_stones enable row level security;
alter table public.floor_plan_calibrations enable row level security;

revoke all on table public.answer_keys, public.answer_key_stones, public.floor_plan_calibrations from anon, authenticated;
revoke all on function public.record_answer_key(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.set_floor_plan_calibration(text, jsonb) from public;
grant execute on function public.record_answer_key(text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.set_floor_plan_calibration(text, jsonb) to service_role;
