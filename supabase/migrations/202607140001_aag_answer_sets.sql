-- AAG object-placement answer data is intentionally separate from participant responses.
-- The six rows created below are empty drafts, not generated object placements.

create table public.aag_answer_sets (
  floor_plan_id text not null check (floor_plan_id in ('FP1', 'FP2')),
  set_id text not null check (set_id in ('S1', 'S2', 'S3')),
  status text not null default 'draft' check (status in ('draft', 'ready')),
  seed text,
  generator_version text,
  authoring_settings jsonb not null default jsonb_build_object(
    'plan_boundary', 'TBD',
    'zones', 'TBD',
    'minimum_distance', 'TBD',
    'wall_clearance', 'TBD',
    'world_to_plan_transform', 'TBD'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (floor_plan_id, set_id)
);

create table public.aag_answer_markers (
  answer_marker_id uuid primary key default gen_random_uuid(),
  floor_plan_id text not null,
  set_id text not null,
  color text not null check (color in ('red', 'blue', 'green', 'yellow')),
  label text not null check (char_length(trim(label)) between 1 and 120),
  world_x double precision not null,
  world_y double precision not null,
  world_z double precision not null,
  plan_x double precision not null check (plan_x between 0 and 1),
  plan_y double precision not null check (plan_y between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (floor_plan_id, set_id)
    references public.aag_answer_sets (floor_plan_id, set_id)
    on delete cascade,
  unique (floor_plan_id, set_id, label)
);

create index aag_answer_markers_set_idx
  on public.aag_answer_markers (floor_plan_id, set_id, color);

insert into public.aag_answer_sets (floor_plan_id, set_id)
values
  ('FP1', 'S1'), ('FP1', 'S2'), ('FP1', 'S3'),
  ('FP2', 'S1'), ('FP2', 'S2'), ('FP2', 'S3')
on conflict (floor_plan_id, set_id) do nothing;

create or replace function public.aag_answer_set_validation(
  p_floor_plan_id text,
  p_set_id text
)
returns table (
  marker_count integer,
  red_count integer,
  blue_count integer,
  green_count integer,
  yellow_count integer,
  out_of_range_plan_coordinate_count integer,
  is_valid boolean
)
language sql
stable
set search_path = public
as $$
  select
    count(*)::integer as marker_count,
    count(*) filter (where color = 'red')::integer as red_count,
    count(*) filter (where color = 'blue')::integer as blue_count,
    count(*) filter (where color = 'green')::integer as green_count,
    count(*) filter (where color = 'yellow')::integer as yellow_count,
    count(*) filter (where plan_x < 0 or plan_x > 1 or plan_y < 0 or plan_y > 1)::integer
      as out_of_range_plan_coordinate_count,
    (
      count(*) = 12
      and count(*) filter (where color = 'red') = 3
      and count(*) filter (where color = 'blue') = 3
      and count(*) filter (where color = 'green') = 3
      and count(*) filter (where color = 'yellow') = 3
      and count(*) filter (where plan_x < 0 or plan_x > 1 or plan_y < 0 or plan_y > 1) = 0
    ) as is_valid
  from public.aag_answer_markers
  where floor_plan_id = p_floor_plan_id and set_id = p_set_id;
$$;

create or replace function public.aag_assert_ready_answer_set()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'ready' and not (
    select is_valid
    from public.aag_answer_set_validation(new.floor_plan_id, new.set_id)
  ) then
    raise exception 'AAG answer set %-% must have 12 markers, three per color, and normalized plan coordinates before it can be ready.', new.floor_plan_id, new.set_id;
  end if;

  return new;
end;
$$;

create trigger aag_answer_sets_ready_validation
before insert or update of status on public.aag_answer_sets
for each row execute function public.aag_assert_ready_answer_set();

create or replace function public.aag_prevent_ready_marker_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  protected_floor_plan_id text := coalesce(new.floor_plan_id, old.floor_plan_id);
  protected_set_id text := coalesce(new.set_id, old.set_id);
begin
  if exists (
    select 1
    from public.aag_answer_sets
    where floor_plan_id = protected_floor_plan_id
      and set_id = protected_set_id
      and status = 'ready'
  ) then
    raise exception 'A ready AAG answer set must be returned to draft before its markers can change.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger aag_answer_markers_ready_protection
before insert or update or delete on public.aag_answer_markers
for each row execute function public.aag_prevent_ready_marker_mutation();

create or replace function public.aag_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger aag_answer_sets_updated_at
before update on public.aag_answer_sets
for each row execute function public.aag_set_updated_at();

create trigger aag_answer_markers_updated_at
before update on public.aag_answer_markers
for each row execute function public.aag_set_updated_at();

create or replace function public.aag_replace_answer_markers(
  p_floor_plan_id text,
  p_set_id text,
  p_markers jsonb,
  p_seed text default null,
  p_generator_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if jsonb_typeof(p_markers) <> 'array' then
    raise exception 'p_markers must be a JSON array.';
  end if;

  select status into current_status
  from public.aag_answer_sets
  where floor_plan_id = p_floor_plan_id and set_id = p_set_id
  for update;

  if current_status is null then
    raise exception 'Unknown AAG answer set %-%', p_floor_plan_id, p_set_id;
  end if;
  if current_status <> 'draft' then
    raise exception 'Return a ready AAG answer set to draft before replacing markers.';
  end if;

  delete from public.aag_answer_markers
  where floor_plan_id = p_floor_plan_id and set_id = p_set_id;

  insert into public.aag_answer_markers (
    answer_marker_id, floor_plan_id, set_id, color, label,
    world_x, world_y, world_z, plan_x, plan_y
  )
  select
    coalesce(marker.answer_marker_id, gen_random_uuid()),
    p_floor_plan_id,
    p_set_id,
    marker.color,
    marker.label,
    marker.world_x,
    marker.world_y,
    marker.world_z,
    marker.plan_x,
    marker.plan_y
  from jsonb_to_recordset(p_markers) as marker(
    answer_marker_id uuid,
    color text,
    label text,
    world_x double precision,
    world_y double precision,
    world_z double precision,
    plan_x double precision,
    plan_y double precision
  );

  update public.aag_answer_sets
  set seed = p_seed,
      generator_version = p_generator_version
  where floor_plan_id = p_floor_plan_id and set_id = p_set_id;
end;
$$;

create or replace function public.aag_set_answer_set_status(
  p_floor_plan_id text,
  p_set_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('draft', 'ready') then
    raise exception 'Unsupported AAG answer set status: %', p_status;
  end if;

  update public.aag_answer_sets
  set status = p_status
  where floor_plan_id = p_floor_plan_id and set_id = p_set_id;

  if not found then
    raise exception 'Unknown AAG answer set %-%', p_floor_plan_id, p_set_id;
  end if;
end;
$$;

create or replace function public.aag_export_answer_set(
  p_floor_plan_id text,
  p_set_id text
)
returns table (
  floor_plan_id text,
  set_id text,
  answer_marker_id uuid,
  color text,
  world_x double precision,
  world_y double precision,
  world_z double precision,
  plan_x double precision,
  plan_y double precision,
  label text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.aag_answer_sets
    where floor_plan_id = p_floor_plan_id and set_id = p_set_id and status = 'ready'
  ) then
    raise exception 'Only ready AAG answer sets can be exported.';
  end if;

  if not (select is_valid from public.aag_answer_set_validation(p_floor_plan_id, p_set_id)) then
    raise exception 'AAG answer set validation failed; export is blocked.';
  end if;

  return query
  select
    marker.floor_plan_id,
    marker.set_id,
    marker.answer_marker_id,
    marker.color,
    marker.world_x,
    marker.world_y,
    marker.world_z,
    marker.plan_x,
    marker.plan_y,
    marker.label
  from public.aag_answer_markers as marker
  where marker.floor_plan_id = p_floor_plan_id and marker.set_id = p_set_id
  order by marker.color, marker.label, marker.answer_marker_id;
end;
$$;

alter table public.aag_answer_sets enable row level security;
alter table public.aag_answer_markers enable row level security;

revoke all on table public.aag_answer_sets, public.aag_answer_markers from anon, authenticated;
revoke all on function public.aag_answer_set_validation(text, text) from public;
revoke all on function public.aag_replace_answer_markers(text, text, jsonb, text, text) from public;
revoke all on function public.aag_set_answer_set_status(text, text, text) from public;
revoke all on function public.aag_export_answer_set(text, text) from public;

grant execute on function public.aag_answer_set_validation(text, text) to service_role;
grant execute on function public.aag_replace_answer_markers(text, text, jsonb, text, text) to service_role;
grant execute on function public.aag_set_answer_set_status(text, text, text) to service_role;
grant execute on function public.aag_export_answer_set(text, text) to service_role;
