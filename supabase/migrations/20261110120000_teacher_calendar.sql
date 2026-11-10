-- Teacher calendars for group and one-on-one booking.
--
-- Opening and closing a 60-minute slot is gated by Supabase Auth linked on
-- public.teachers.auth_user_id. It does not use the host PIN or a room PIN.
-- Vanessa is the operator (view and emergency close). Andy stays a teacher.
-- auth_user_id is left null until the operator links a real login. This file
-- does not invent an email or a password.
--
-- Do not delete or rewrite the existing open group rows:
--   4c2cfa7e-3453-4423-b140-2cf8d5fe0b5a  2026-11-11 19:00 Asia/Hong_Kong
--   dd7abde4-fb40-4632-a1de-69ef106162ae  2026-11-12 19:00 Asia/Hong_Kong
--   de0a62e7-b5bd-4fb4-b216-9eb9a331f42b  2026-11-14 15:00 Asia/Hong_Kong
--
-- Apply in the Supabase SQL editor, then reload the API schema cache.
-- Link a login only after that person exists in Authentication → Users:
--   select public.link_teacher_login('andy', 'email-from-vanessa');
--   select public.link_teacher_login('vanessa', 'operator-email');
-- Or pass the auth user id instead of an email:
--   select public.link_teacher_login('andy', null, '00000000-0000-0000-0000-000000000000');
-- Invite redirect URL to allow: https://belief-game-capstone.vercel.app/teacher
-- and the local /teacher path used in development.

alter table public.teachers
  add column if not exists auth_user_id uuid,
  add column if not exists calendar_role text;

update public.teachers
set calendar_role = 'teacher'
where calendar_role is null;

alter table public.teachers
  alter column calendar_role set default 'teacher';

alter table public.teachers
  alter column calendar_role set not null;

alter table public.teachers
  drop constraint if exists teachers_calendar_role_check;

alter table public.teachers
  add constraint teachers_calendar_role_check
  check (calendar_role in ('teacher', 'operator'));

alter table public.teachers
  drop constraint if exists teachers_auth_user_id_fkey;

alter table public.teachers
  add constraint teachers_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users (id) on delete set null;

alter table public.teachers
  drop constraint if exists teachers_auth_user_id_key;

alter table public.teachers
  add constraint teachers_auth_user_id_key unique (auth_user_id);

update public.teachers
set calendar_role = 'operator'
where slug = 'vanessa';

update public.teachers
set calendar_role = 'teacher'
where slug = 'andy';

-- Widen the check if an older database still stops at 30.
-- Do not update existing capacities. The three test rows stay as they are.
alter table public.booking_slots
  drop constraint if exists booking_slots_capacity_check;

alter table public.booking_slots
  add constraint booking_slots_capacity_check
  check (capacity >= 1 and capacity <= 200);

create index if not exists booking_slots_teacher_kind_starts_idx
  on public.booking_slots (teacher_id, kind, starts_at)
  where status <> 'cancelled';

create or replace function public._slot_json(p_slot public.booking_slots)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_slot.id,
    'kind', p_slot.kind,
    'startsAt', p_slot.starts_at,
    'capacity', p_slot.capacity,
    'bookedCount', (
      select count(*)::integer
      from public.bookings b
      where b.slot_id = p_slot.id
        and b.status = 'confirmed'
    ),
    'hostLabel', p_slot.host_label,
    'teacherId', p_slot.teacher_id,
    'roomCode', p_slot.room_code,
    'status', p_slot.status
  );
$$;

create or replace function public._teacher_actor()
returns public.teachers
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_teacher public.teachers;
begin
  if auth.uid() is null then
    return null;
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return null;
  end if;

  select * into v_teacher
  from public.teachers
  where auth_user_id = auth.uid();

  if not found then
    return null;
  end if;
  return v_teacher;
end;
$$;

create or replace function public._on_the_hour(p_starts_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_starts_at is not null
    and (p_starts_at at time zone 'Asia/Hong_Kong')
      = date_trunc('hour', p_starts_at at time zone 'Asia/Hong_Kong');
$$;

create or replace function public.link_teacher_login(
  p_slug text,
  p_email text default null,
  p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_user uuid := p_auth_user_id;
  v_from_email uuid;
  v_email_count integer := 0;
  v_teacher public.teachers;
begin
  if v_slug !~ '^[a-z0-9-]{2,40}$' then
    return jsonb_build_object('ok', false, 'error', 'teacher_unavailable');
  end if;
  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  if v_email is null and v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_user_missing');
  end if;

  if v_email is not null then
    select count(*) into v_email_count
    from auth.users
    where lower(email) = v_email;

    if v_email_count = 0 then
      return jsonb_build_object('ok', false, 'error', 'auth_user_missing');
    end if;
    if v_email_count > 1 then
      return jsonb_build_object('ok', false, 'error', 'auth_user_ambiguous');
    end if;

    select id into v_from_email
    from auth.users
    where lower(email) = v_email;

    if v_user is not null and v_user is distinct from v_from_email then
      return jsonb_build_object('ok', false, 'error', 'auth_user_ambiguous');
    end if;
    v_user := v_from_email;
  end if;

  if not exists (select 1 from auth.users where id = v_user) then
    return jsonb_build_object('ok', false, 'error', 'auth_user_missing');
  end if;

  if exists (
    select 1
    from public.teachers
    where auth_user_id = v_user
      and slug <> v_slug
  ) then
    return jsonb_build_object('ok', false, 'error', 'auth_user_taken');
  end if;

  update public.teachers
  set auth_user_id = v_user
  where slug = v_slug
  returning * into v_teacher;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'teacher_unavailable');
  end if;

  return jsonb_build_object(
    'ok', true,
    'slug', v_teacher.slug,
    'role', v_teacher.calendar_role,
    'authUserId', v_teacher.auth_user_id
  );
end;
$$;

create or replace function public.teacher_me()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.teachers;
  v_directory jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_actor := public._teacher_actor();
  if v_actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'teacher_not_linked');
  end if;

  if v_actor.calendar_role = 'operator' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'slug', t.slug,
          'name', t.name,
          'bookable', t.bookable
        )
        order by t.name
      ),
      '[]'::jsonb
    )
    into v_directory
    from public.teachers t;
  end if;

  return jsonb_build_object(
    'ok', true,
    'teacher', jsonb_build_object(
      'id', v_actor.id,
      'slug', v_actor.slug,
      'name', v_actor.name,
      'role', v_actor.calendar_role,
      'bookable', v_actor.bookable
    ),
    'directory', v_directory
  );
end;
$$;

create or replace function public.teacher_list_slots(
  p_kind text,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.teachers;
  v_rows jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_actor := public._teacher_actor();
  if v_actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'teacher_not_linked');
  end if;
  if p_kind is null or p_kind not in ('group', 'one_on_one') then
    return jsonb_build_object('ok', false, 'error', 'kind');
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + interval '45 days' then
    return jsonb_build_object('ok', false, 'error', 'starts_at');
  end if;

  select coalesce(
    jsonb_agg(public._slot_json(s) order by s.starts_at),
    '[]'::jsonb
  )
  into v_rows
  from public.booking_slots s
  where s.kind = p_kind
    and s.status <> 'cancelled'
    and s.starts_at >= p_from
    and s.starts_at < p_to
    and (
      v_actor.calendar_role = 'operator'
      or s.teacher_id = v_actor.id
      or (s.teacher_id is null and s.host_label = v_actor.name)
    );

  return jsonb_build_object('ok', true, 'slots', v_rows);
end;
$$;

create or replace function public.teacher_open_slot(
  p_kind text,
  p_starts_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.teachers;
  v_slot public.booking_slots;
  v_capacity integer;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_actor := public._teacher_actor();
  if v_actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'teacher_not_linked');
  end if;
  if not v_actor.bookable or v_actor.calendar_role <> 'teacher' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_kind is null or p_kind not in ('group', 'one_on_one') then
    return jsonb_build_object('ok', false, 'error', 'kind');
  end if;
  if not public._starts_ok(p_starts_at) then
    return jsonb_build_object('ok', false, 'error', 'starts_at');
  end if;
  if not public._on_the_hour(p_starts_at) then
    return jsonb_build_object('ok', false, 'error', 'slot_hour');
  end if;

  perform pg_advisory_xact_lock(hashtext('teacher-slot:' || v_actor.id::text));

  if exists (
    select 1
    from public.booking_slots s
    where s.status <> 'cancelled'
      and s.starts_at < p_starts_at + interval '60 minutes'
      and s.starts_at + interval '60 minutes' > p_starts_at
      and (
        s.teacher_id = v_actor.id
        or (s.teacher_id is null and s.host_label = v_actor.name)
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'slot_overlap');
  end if;

  v_capacity := case when p_kind = 'one_on_one' then 1 else 200 end;

  insert into public.booking_slots (kind, starts_at, capacity, host_label, teacher_id, room_code, status)
  values (p_kind, p_starts_at, v_capacity, v_actor.name, v_actor.id, null, 'open')
  returning * into v_slot;

  return jsonb_build_object('ok', true, 'slot', public._slot_json(v_slot));
end;
$$;

create or replace function public.teacher_close_slot(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.teachers;
  v_slot public.booking_slots;
  v_owns boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_actor := public._teacher_actor();
  if v_actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'teacher_not_linked');
  end if;

  select * into v_slot
  from public.booking_slots
  where id = p_slot_id
  for update;

  if not found or v_slot.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  v_owns := v_slot.teacher_id = v_actor.id
    or (v_slot.teacher_id is null and v_slot.host_label = v_actor.name);

  if v_actor.calendar_role <> 'operator' and not v_owns then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.booking_slots
  set status = 'cancelled'
  where id = v_slot.id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.teacher_list_bookings(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.teachers;
  v_slot public.booking_slots;
  v_owns boolean;
  v_rows jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_actor := public._teacher_actor();
  if v_actor.id is null then
    return jsonb_build_object('ok', false, 'error', 'teacher_not_linked');
  end if;

  select * into v_slot from public.booking_slots where id = p_slot_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  v_owns := v_slot.teacher_id = v_actor.id
    or (v_slot.teacher_id is null and v_slot.host_label = v_actor.name);

  if v_actor.calendar_role <> 'operator' and not v_owns then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', b.display_name,
        'contact', b.contact,
        'createdAt', b.created_at
      )
      order by b.created_at
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.bookings b
  where b.slot_id = p_slot_id
    and b.status = 'confirmed';

  return jsonb_build_object('ok', true, 'bookings', v_rows);
end;
$$;

create or replace function public.list_booking_board()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'teachers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'slug', t.slug,
          'name', t.name,
          'summary', t.summary,
          'summaryEn', t.summary_en,
          'bookable', t.bookable
        )
        order by t.bookable desc, t.name
      )
      from public.teachers t
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(
        public._slot_json(s)
        order by s.starts_at
      )
      from public.booking_slots s
      where s.kind in ('group', 'one_on_one')
        and s.status <> 'cancelled'
        and s.starts_at > now() - interval '12 hours'
        and (
          s.teacher_id is null
          or exists (
            select 1
            from public.teachers t
            where t.id = s.teacher_id
              and t.bookable
          )
        )
        and not exists (
          select 1
          from public.teachers t
          where t.bookable = false
            and t.name = s.host_label
        )
    ), '[]'::jsonb)
  );
$$;

create or replace function public.join_booking_slot(
  p_slot_id uuid,
  p_display_name text,
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.booking_slots;
  v_name text := public._clean_person(p_display_name);
  v_contact text := public._clean_contact(p_contact);
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_display_name');
  end if;
  if v_contact = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_contact');
  end if;

  select * into v_slot
  from public.booking_slots
  where id = p_slot_id
  for update;

  if not found or v_slot.kind <> 'group' then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;
  if v_slot.teacher_id is not null and not exists (
    select 1 from public.teachers t where t.id = v_slot.teacher_id and t.bookable
  ) then
    return jsonb_build_object('ok', false, 'error', 'teacher_unavailable');
  end if;
  if exists (
    select 1 from public.teachers t
    where t.bookable = false
      and t.name = v_slot.host_label
  ) then
    return jsonb_build_object('ok', false, 'error', 'teacher_unavailable');
  end if;
  if v_slot.status = 'full' then
    return jsonb_build_object('ok', false, 'error', 'slot_full');
  end if;
  if v_slot.status <> 'open' or v_slot.starts_at < now() - interval '12 hours' then
    return jsonb_build_object('ok', false, 'error', 'slot_closed');
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.slot_id = v_slot.id
      and b.status = 'confirmed'
      and lower(b.display_name) = lower(v_name)
  ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if public._booking_limited() then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select count(*) into v_count
  from public.bookings b
  where b.slot_id = v_slot.id
    and b.status = 'confirmed';

  if v_count >= v_slot.capacity then
    update public.booking_slots set status = 'full' where id = v_slot.id;
    return jsonb_build_object('ok', false, 'error', 'slot_full');
  end if;

  insert into public.bookings (slot_id, display_name, contact, teacher_id, created_by)
  values (v_slot.id, v_name, v_contact, v_slot.teacher_id, auth.uid());

  if v_count + 1 >= v_slot.capacity then
    update public.booking_slots set status = 'full' where id = v_slot.id;
  end if;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

drop function if exists public.book_one_on_one(uuid, timestamptz, text, text);

create or replace function public.book_one_on_one(
  p_slot_id uuid,
  p_display_name text,
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.booking_slots;
  v_name text := public._clean_person(p_display_name);
  v_contact text := public._clean_contact(p_contact);
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if v_name = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_display_name');
  end if;
  if v_contact = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_contact');
  end if;

  select * into v_slot
  from public.booking_slots
  where id = p_slot_id
  for update;

  if not found or v_slot.kind <> 'one_on_one' or v_slot.teacher_id is null then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;
  if not exists (
    select 1 from public.teachers t where t.id = v_slot.teacher_id and t.bookable
  ) then
    return jsonb_build_object('ok', false, 'error', 'teacher_unavailable');
  end if;
  if v_slot.status = 'full' then
    return jsonb_build_object('ok', false, 'error', 'slot_full');
  end if;
  if v_slot.status <> 'open' or v_slot.starts_at < now() - interval '12 hours' then
    return jsonb_build_object('ok', false, 'error', 'slot_closed');
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.slot_id = v_slot.id
      and b.status = 'confirmed'
      and lower(b.display_name) = lower(v_name)
  ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if public._booking_limited() then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select count(*) into v_count
  from public.bookings b
  where b.slot_id = v_slot.id
    and b.status = 'confirmed';

  if v_count >= v_slot.capacity then
    update public.booking_slots set status = 'full' where id = v_slot.id;
    return jsonb_build_object('ok', false, 'error', 'slot_full');
  end if;

  insert into public.bookings (slot_id, display_name, contact, teacher_id, created_by)
  values (v_slot.id, v_name, v_contact, v_slot.teacher_id, auth.uid());

  update public.booking_slots
  set status = 'full'
  where id = v_slot.id
    and v_count + 1 >= capacity;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public._slot_json(public.booking_slots) from public, anon, authenticated;
revoke all on function public._teacher_actor() from public, anon, authenticated;
revoke all on function public._on_the_hour(timestamptz) from public, anon, authenticated;
revoke all on function public.link_teacher_login(text, text, uuid) from public, anon, authenticated;

revoke all on function public.teacher_me() from public, anon, authenticated;
revoke all on function public.teacher_list_slots(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.teacher_open_slot(text, timestamptz) from public, anon, authenticated;
revoke all on function public.teacher_close_slot(uuid) from public, anon, authenticated;
revoke all on function public.teacher_list_bookings(uuid) from public, anon, authenticated;
revoke all on function public.book_one_on_one(uuid, text, text) from public;

grant execute on function public.link_teacher_login(text, text, uuid) to service_role;
grant execute on function public.teacher_me() to authenticated, service_role;
grant execute on function public.teacher_list_slots(text, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.teacher_open_slot(text, timestamptz) to authenticated, service_role;
grant execute on function public.teacher_close_slot(uuid) to authenticated, service_role;
grant execute on function public.teacher_list_bookings(uuid) to authenticated, service_role;
grant execute on function public.book_one_on_one(uuid, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
