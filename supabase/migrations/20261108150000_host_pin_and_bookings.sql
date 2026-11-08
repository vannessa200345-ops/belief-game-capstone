-- Host PIN, group slots, and one-on-one bookings.
--
-- The platform operator PIN is stored only as a bcrypt ($2a$) hash.
-- Do not put that PIN in VITE_ environment variables or frontend source.
-- Session hosts set their own PIN after a one-time claim code. Players join
-- a room with no password.
--
-- Host-chosen slot capacity must stay between 1 and 30. This migration does
-- not update rooms.max_players and does not remove the technical room cap.
--
-- Apply in the Supabase SQL editor. The frontend cannot change the live
-- database by itself. Reload the API schema cache after applying.

create extension if not exists pgcrypto with schema extensions;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null,
  summary_en text not null,
  bookable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('group', 'one_on_one')),
  starts_at timestamptz not null,
  capacity integer not null check (capacity >= 1 and capacity <= 30),
  host_label text,
  teacher_id uuid references public.teachers (id),
  room_code text,
  status text not null default 'open' check (status in ('open', 'full', 'cancelled', 'started')),
  created_at timestamptz not null default now(),
  check (
    (kind = 'group' and capacity >= 1)
    or (kind = 'one_on_one' and capacity = 1)
  )
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.booking_slots (id) on delete cascade,
  display_name text not null,
  contact text,
  teacher_id uuid references public.teachers (id),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.host_credentials (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('operator', 'session')),
  room_code text,
  slot_id uuid references public.booking_slots (id) on delete set null,
  pin_hash text not null,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (scope = 'operator' and room_code is null and slot_id is null)
    or (scope = 'session' and room_code is not null)
  ),
  check (pin_hash <> '')
);

create table public.host_claims (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.booking_slots (id) on delete cascade,
  room_code text,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  expires_at timestamptz not null
);

create table public.host_pin_attempts (
  id bigint generated always as identity primary key,
  bucket text not null,
  ok boolean not null,
  attempted_at timestamptz not null default now()
);

create index booking_slots_group_starts_idx
  on public.booking_slots (starts_at)
  where kind = 'group' and status <> 'cancelled';

create index bookings_slot_confirmed_idx
  on public.bookings (slot_id)
  where status = 'confirmed';

create index bookings_actor_idx
  on public.bookings (created_by, created_at);

create unique index host_credentials_one_active_session
  on public.host_credentials (room_code)
  where scope = 'session' and revoked_at is null and room_code is not null;

create index host_pin_attempts_bucket_idx
  on public.host_pin_attempts (bucket, attempted_at desc);

create index host_pin_attempts_recent_idx
  on public.host_pin_attempts (attempted_at desc);

alter table public.teachers enable row level security;
alter table public.booking_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.host_credentials enable row level security;
alter table public.host_claims enable row level security;
alter table public.host_pin_attempts enable row level security;

revoke all on table public.teachers from public, anon, authenticated;
revoke all on table public.booking_slots from public, anon, authenticated;
revoke all on table public.bookings from public, anon, authenticated;
revoke all on table public.host_credentials from public, anon, authenticated;
revoke all on table public.host_claims from public, anon, authenticated;
revoke all on table public.host_pin_attempts from public, anon, authenticated;

insert into public.teachers (slug, name, summary, summary_en, bookable)
values
  (
    'andy',
    'Andy',
    '希塔療癒。現時可預約。',
    'Theta Healing. Available now.',
    true
  ),
  (
    'vanessa',
    'Vanessa',
    'Quantum healing。認證量子療癒師。現時可預約。',
    'Quantum healing. Certified quantum practitioner. Available now.',
    true
  );

-- bcrypt hash only. Generated with pgcrypto crypt(..., gen_salt('bf', 12)).
insert into public.host_credentials (scope, label, pin_hash)
values (
  'operator',
  'platform',
  '$2a$12$dZVhM22F6fNb3ZihevEwz.DaFLc10vDu7zA3L79wQghFPkpDJYVIa'
);

create or replace function public._room_code(p_room_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_code text := nullif(upper(trim(coalesce(p_room_code, ''))), '');
begin
  if v_code is null then
    return null;
  end if;
  if v_code ~ '^[A-Z0-9]{2,8}$' then
    return v_code;
  end if;
  return '';
end;
$$;

create or replace function public._host_scope(p_pin text, p_room_code text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := public._room_code(p_room_code);
  v_hash text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return null;
  end if;

  if exists (
    select 1
    from public.host_credentials
    where scope = 'operator'
      and revoked_at is null
      and pin_hash = crypt(p_pin, pin_hash)
  ) then
    return 'operator';
  end if;

  if v_code is null or v_code = '' then
    return null;
  end if;

  select pin_hash into v_hash
  from public.host_credentials
  where scope = 'session'
    and revoked_at is null
    and room_code = v_code
  limit 1;

  if v_hash is not null and v_hash = crypt(p_pin, v_hash) then
    return 'session';
  end if;

  return null;
end;
$$;

create or replace function public._pin_limited()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text := coalesce(auth.uid()::text, 'anon');
  v_recent integer;
  v_user_fail integer;
begin
  delete from public.host_pin_attempts
  where attempted_at < now() - interval '2 days';

  select count(*) into v_recent
  from public.host_pin_attempts
  where ok = false
    and attempted_at > now() - interval '1 minute';

  select count(*) into v_user_fail
  from public.host_pin_attempts
  where bucket = v_bucket
    and ok = false
    and attempted_at > now() - interval '10 minutes';

  return v_recent >= 80 or v_user_fail >= 8;
end;
$$;

create or replace function public._note_pin(p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.host_pin_attempts (bucket, ok)
  values (coalesce(auth.uid()::text, 'anon'), p_ok);
end;
$$;

create or replace function public._new_claim(p_slot_id uuid, p_room_code text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(16), 'hex');
begin
  update public.host_claims
  set expires_at = now()
  where slot_id = p_slot_id
    and claimed_at is null
    and expires_at > now();

  insert into public.host_claims (slot_id, room_code, token_hash, expires_at)
  values (
    p_slot_id,
    p_room_code,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + interval '14 days'
  );

  return v_token;
end;
$$;

create or replace function public.verify_host_pin(p_pin text, p_room_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := public._room_code(p_room_code);
  v_scope text;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  if public._pin_limited() then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    perform public._note_pin(false);
    return jsonb_build_object('ok', false, 'error', 'pin_format');
  end if;

  v_scope := public._host_scope(p_pin, v_code);
  perform public._note_pin(v_scope is not null);

  if v_scope is null then
    return jsonb_build_object('ok', false, 'error', 'pin_rejected');
  end if;

  return jsonb_build_object('ok', true, 'scope', v_scope);
end;
$$;

create or replace function public._clean_label(p_label text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_label text := nullif(trim(coalesce(p_label, '')), '');
begin
  if v_label is null then
    return null;
  end if;
  if char_length(v_label) > 32 or v_label ~ '[[:cntrl:]]' then
    return '';
  end if;
  return v_label;
end;
$$;

create or replace function public._clean_person(p_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_name is null or char_length(v_name) > 32 or v_name ~ '[[:cntrl:]]' then
    return '';
  end if;
  return v_name;
end;
$$;

create or replace function public._clean_contact(p_contact text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_contact text := nullif(trim(coalesce(p_contact, '')), '');
begin
  if v_contact is null then
    return null;
  end if;
  if char_length(v_contact) > 80 or v_contact ~ '[[:cntrl:]]' then
    return '';
  end if;
  return v_contact;
end;
$$;

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
    'roomCode', p_slot.room_code,
    'status', p_slot.status
  );
$$;

create or replace function public._starts_ok(p_starts_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_starts_at is not null
    and p_starts_at >= now() - interval '5 minutes'
    and p_starts_at <= now() + interval '2 years';
$$;

create or replace function public._booking_limited()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user integer;
  v_recent integer;
begin
  if auth.uid() is null then
    return true;
  end if;

  select count(*) into v_user
  from public.bookings
  where created_by = auth.uid()
    and created_at > now() - interval '1 hour';

  select count(*) into v_recent
  from public.bookings
  where created_at > now() - interval '1 minute';

  return v_user >= 6 or v_recent >= 120;
end;
$$;

create or replace function public.create_booking_slot(
  p_proof_pin text,
  p_starts_at timestamptz,
  p_capacity integer,
  p_host_label text default null,
  p_room_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_proof jsonb;
  v_code text := public._room_code(p_room_code);
  v_label text := public._clean_label(p_host_label);
  v_slot public.booking_slots;
  v_token text;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > 30 then
    return jsonb_build_object('ok', false, 'error', 'capacity');
  end if;
  if not public._starts_ok(p_starts_at) then
    return jsonb_build_object('ok', false, 'error', 'starts_at');
  end if;
  if v_label = '' then
    return jsonb_build_object('ok', false, 'error', 'host_label');
  end if;

  v_proof := public.verify_host_pin(p_proof_pin, v_code);
  if coalesce(v_proof->>'ok', 'false') <> 'true' then
    return v_proof;
  end if;

  insert into public.booking_slots (kind, starts_at, capacity, host_label, room_code, status)
  values ('group', p_starts_at, p_capacity, v_label, v_code, 'open')
  returning * into v_slot;

  v_token := public._new_claim(v_slot.id, v_code);

  return jsonb_build_object(
    'ok', true,
    'claimToken', v_token,
    'slot', public._slot_json(v_slot)
  );
end;
$$;

create or replace function public.issue_slot_claim(
  p_slot_id uuid,
  p_proof_pin text,
  p_room_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_slot public.booking_slots;
  v_code text := public._room_code(p_room_code);
  v_proof jsonb;
  v_scope text;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  select * into v_slot from public.booking_slots where id = p_slot_id;
  if not found or v_slot.kind <> 'group' or v_slot.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  v_proof := public.verify_host_pin(p_proof_pin, coalesce(v_code, v_slot.room_code));
  if coalesce(v_proof->>'ok', 'false') <> 'true' then
    return v_proof;
  end if;

  v_scope := v_proof->>'scope';
  if v_scope = 'session' and (v_slot.room_code is null or v_slot.room_code is distinct from coalesce(v_code, v_slot.room_code)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  return jsonb_build_object(
    'ok', true,
    'claimToken', public._new_claim(v_slot.id, v_slot.room_code)
  );
end;
$$;

create or replace function public.set_session_host_pin(
  p_room_code text,
  p_new_pin text,
  p_proof_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := public._room_code(p_room_code);
  v_proof jsonb;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'pin_format');
  end if;
  if public._host_scope(p_new_pin, null) = 'operator' then
    return jsonb_build_object('ok', false, 'error', 'pin_reserved');
  end if;

  v_proof := public.verify_host_pin(p_proof_pin, v_code);
  if coalesce(v_proof->>'ok', 'false') <> 'true' then
    return v_proof;
  end if;

  update public.host_credentials
  set revoked_at = now()
  where scope = 'session'
    and revoked_at is null
    and room_code = v_code;

  insert into public.host_credentials (scope, room_code, pin_hash, label)
  values ('session', v_code, crypt(p_new_pin, gen_salt('bf', 10)), 'session');

  return jsonb_build_object('ok', true, 'scope', 'session');
end;
$$;

create or replace function public.claim_session_host_pin(
  p_claim_token text,
  p_room_code text,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := lower(trim(coalesce(p_claim_token, '')));
  v_code text := public._room_code(p_room_code);
  v_hash text;
  v_claim public.host_claims;
  v_slot public.booking_slots;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'pin_format');
  end if;
  if v_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'error', 'claim_invalid');
  end if;
  if public._pin_limited() then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if public._host_scope(p_new_pin, null) = 'operator' then
    perform public._note_pin(false);
    return jsonb_build_object('ok', false, 'error', 'pin_reserved');
  end if;

  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  select * into v_claim
  from public.host_claims
  where token_hash = v_hash
    and claimed_at is null
    and expires_at > now()
  for update;

  if not found then
    perform public._note_pin(false);
    return jsonb_build_object('ok', false, 'error', 'claim_invalid');
  end if;

  if v_claim.room_code is not null and v_claim.room_code <> v_code then
    perform public._note_pin(false);
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  select * into v_slot from public.booking_slots where id = v_claim.slot_id for update;
  if not found or v_slot.status = 'cancelled' then
    perform public._note_pin(false);
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;
  if v_slot.room_code is not null and v_slot.room_code <> v_code then
    perform public._note_pin(false);
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  update public.host_claims set claimed_at = now() where id = v_claim.id;

  update public.host_credentials
  set revoked_at = now()
  where scope = 'session'
    and revoked_at is null
    and room_code = v_code;

  insert into public.host_credentials (scope, room_code, slot_id, pin_hash, label)
  values ('session', v_code, v_slot.id, crypt(p_new_pin, gen_salt('bf', 10)), 'session');

  update public.booking_slots
  set room_code = v_code
  where id = v_slot.id
    and room_code is null;

  perform public._note_pin(true);
  return jsonb_build_object('ok', true, 'scope', 'session');
end;
$$;

create or replace function public.attach_slot_room(
  p_slot_id uuid,
  p_room_code text,
  p_proof_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := public._room_code(p_room_code);
  v_slot public.booking_slots;
  v_proof jsonb;
  v_scope text;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  select * into v_slot from public.booking_slots where id = p_slot_id for update;
  if not found or v_slot.kind <> 'group' or v_slot.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  v_proof := public.verify_host_pin(p_proof_pin, v_code);
  if coalesce(v_proof->>'ok', 'false') <> 'true' then
    return v_proof;
  end if;

  v_scope := v_proof->>'scope';
  if v_scope = 'session' and v_slot.room_code is not null and v_slot.room_code <> v_code then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.booking_slots set room_code = v_code where id = v_slot.id;
  v_slot.room_code := v_code;

  return jsonb_build_object('ok', true, 'slot', public._slot_json(v_slot));
end;
$$;

create or replace function public.cancel_booking_slot(
  p_slot_id uuid,
  p_proof_pin text,
  p_room_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_slot public.booking_slots;
  v_code text := public._room_code(p_room_code);
  v_proof jsonb;
  v_scope text;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  select * into v_slot from public.booking_slots where id = p_slot_id for update;
  if not found or v_slot.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  v_proof := public.verify_host_pin(p_proof_pin, coalesce(v_code, v_slot.room_code));
  if coalesce(v_proof->>'ok', 'false') <> 'true' then
    return v_proof;
  end if;

  v_scope := v_proof->>'scope';
  if v_scope <> 'operator' and (v_slot.room_code is null or v_slot.room_code is distinct from v_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.booking_slots set status = 'cancelled' where id = v_slot.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_slot_bookings(
  p_slot_id uuid,
  p_proof_pin text,
  p_room_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_slot public.booking_slots;
  v_code text := public._room_code(p_room_code);
  v_proof jsonb;
  v_scope text;
  v_rows jsonb;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'room_code');
  end if;

  select * into v_slot from public.booking_slots where id = p_slot_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'slot_not_found');
  end if;

  v_proof := public.verify_host_pin(p_proof_pin, coalesce(v_code, v_slot.room_code));
  if coalesce(v_proof->>'ok', 'false') <> 'true' then
    return v_proof;
  end if;

  v_scope := v_proof->>'scope';
  if v_scope <> 'operator' and (v_slot.room_code is null or v_slot.room_code is distinct from v_code) then
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
          'summaryEn', t.summary_en
        )
        order by t.name
      )
      from public.teachers t
      where t.bookable
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(
        public._slot_json(s)
        order by s.starts_at
      )
      from public.booking_slots s
      where s.kind = 'group'
        and s.status <> 'cancelled'
        and s.starts_at > now() - interval '12 hours'
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

create or replace function public.book_one_on_one(
  p_teacher_id uuid,
  p_starts_at timestamptz,
  p_display_name text,
  p_contact text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher public.teachers;
  v_name text := public._clean_person(p_display_name);
  v_contact text := public._clean_contact(p_contact);
  v_slot_id uuid;
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
  if not public._starts_ok(p_starts_at) then
    return jsonb_build_object('ok', false, 'error', 'starts_at');
  end if;
  if public._booking_limited() then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into v_teacher from public.teachers where id = p_teacher_id;
  if not found or not v_teacher.bookable then
    return jsonb_build_object('ok', false, 'error', 'teacher_unavailable');
  end if;

  if exists (
    select 1
    from public.booking_slots s
    where s.teacher_id = v_teacher.id
      and s.kind = 'one_on_one'
      and s.status <> 'cancelled'
      and date_trunc('minute', s.starts_at) = date_trunc('minute', p_starts_at)
  ) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  insert into public.booking_slots (kind, starts_at, capacity, teacher_id, host_label, status)
  values ('one_on_one', p_starts_at, 1, v_teacher.id, v_teacher.name, 'full')
  returning id into v_slot_id;

  insert into public.bookings (slot_id, display_name, contact, teacher_id, created_by)
  values (v_slot_id, v_name, v_contact, v_teacher.id, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public._room_code(text) from public, anon, authenticated;
revoke all on function public._host_scope(text, text) from public, anon, authenticated;
revoke all on function public._pin_limited() from public, anon, authenticated;
revoke all on function public._note_pin(boolean) from public, anon, authenticated;
revoke all on function public._new_claim(uuid, text) from public, anon, authenticated;
revoke all on function public._clean_label(text) from public, anon, authenticated;
revoke all on function public._clean_person(text) from public, anon, authenticated;
revoke all on function public._clean_contact(text) from public, anon, authenticated;
revoke all on function public._slot_json(public.booking_slots) from public, anon, authenticated;
revoke all on function public._starts_ok(timestamptz) from public, anon, authenticated;
revoke all on function public._booking_limited() from public, anon, authenticated;

revoke all on function public.verify_host_pin(text, text) from public;
revoke all on function public.create_booking_slot(text, timestamptz, integer, text, text) from public;
revoke all on function public.issue_slot_claim(uuid, text, text) from public;
revoke all on function public.set_session_host_pin(text, text, text) from public;
revoke all on function public.claim_session_host_pin(text, text, text) from public;
revoke all on function public.attach_slot_room(uuid, text, text) from public;
revoke all on function public.cancel_booking_slot(uuid, text, text) from public;
revoke all on function public.list_slot_bookings(uuid, text, text) from public;
revoke all on function public.list_booking_board() from public;
revoke all on function public.join_booking_slot(uuid, text, text) from public;
revoke all on function public.book_one_on_one(uuid, timestamptz, text, text) from public;

grant execute on function public.verify_host_pin(text, text) to anon, authenticated, service_role;
grant execute on function public.create_booking_slot(text, timestamptz, integer, text, text) to anon, authenticated, service_role;
grant execute on function public.issue_slot_claim(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.set_session_host_pin(text, text, text) to anon, authenticated, service_role;
grant execute on function public.claim_session_host_pin(text, text, text) to anon, authenticated, service_role;
grant execute on function public.attach_slot_room(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.cancel_booking_slot(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.list_slot_bookings(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.list_booking_board() to anon, authenticated, service_role;
grant execute on function public.join_booking_slot(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.book_one_on_one(uuid, timestamptz, text, text) to anon, authenticated, service_role;
