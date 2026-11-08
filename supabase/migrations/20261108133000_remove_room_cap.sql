-- The product no longer has an app-enforced headcount.
-- join_room used to raise room_full when the room reached max_players (created as 30).
-- NULL max_players means no product cap. Any remaining ceiling is infrastructure.

alter table public.rooms alter column max_players drop not null;
alter table public.rooms alter column max_players set default null;
update public.rooms set max_players = null where max_players is not null;

do $mig$
declare
  rec record;
  cleaned text;
  changed integer := 0;
begin
  for rec in
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_functiondef(p.oid) ilike '%room_full%'
  loop
    cleaned := regexp_replace(rec.def, 'raise[\s\S]*?room_full[\s\S]*?;', 'perform 1;', 'gi');
    cleaned := regexp_replace(
      cleaned,
      'coalesce\s*\(\s*([^,()]*max_players[^,()]*)\s*,\s*30\s*\)',
      '\1',
      'gi'
    );
    if cleaned is distinct from rec.def then
      execute cleaned;
      changed := changed + 1;
      raise notice 'removed room headcount cap from %', rec.proname;
    end if;
  end loop;

  if changed = 0 then
    raise warning 'no room_full raise found; confirm join_room no longer rejects on headcount';
  end if;
end
$mig$;
