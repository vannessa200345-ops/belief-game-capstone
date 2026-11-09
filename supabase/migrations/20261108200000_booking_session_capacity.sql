-- A booking session can register 200 people. This does not write rooms.max_players.
-- Game rooms stay uncapped (hard_max_players and lobby max_players remain null).

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.booking_slots'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%<= 30%'
  loop
    execute format('alter table public.booking_slots drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.booking_slots
  drop constraint if exists booking_slots_capacity_check;

alter table public.booking_slots
  add constraint booking_slots_capacity_check
  check (capacity >= 1 and capacity <= 200);

update public.booking_slots
set capacity = 200
where kind = 'group'
  and capacity < 200;

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

  -- Always store 200. The argument is kept so existing clients still call this function.
  insert into public.booking_slots (kind, starts_at, capacity, host_label, room_code, status)
  values ('group', p_starts_at, 200, v_label, v_code, 'open')
  returning * into v_slot;

  v_token := public._new_claim(v_slot.id, v_code);

  return jsonb_build_object(
    'ok', true,
    'claimToken', v_token,
    'slot', public._slot_json(v_slot)
  );
end;
$$;

-- Touch the unused argument so a strict linter does not treat it as accidental.
comment on function public.create_booking_slot(text, timestamptz, integer, text, text) is
  'Opens a group booking. p_capacity is ignored; the session stores 200 registrations.';
