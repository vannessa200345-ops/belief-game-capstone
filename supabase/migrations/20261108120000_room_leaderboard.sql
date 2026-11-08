-- Room members can read how many answers matched, without choices or the answer key.
-- card_events is limited to the caller's own rows (the host can read the whole room).
-- This function counts on the base tables as the owner, after checking membership.

create or replace function public.get_room_leaderboard(p_room_id uuid)
returns table (player_id uuid, correct_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  if not exists (
    select 1
    from public.players me
    where me.room_id = p_room_id
      and me.auth_user_id = auth.uid()
      and me.left_at is null
  ) then
    return;
  end if;

  return query
  select latest.player_id, count(*)::integer as correct_count
  from (
    select distinct on (a.player_id, r.card_id)
      a.player_id,
      a.is_correct
    from public.answers a
    join public.rounds r on r.id = a.round_id
    where r.room_id = p_room_id
    order by a.player_id, r.card_id, a.responded_at desc nulls last
  ) latest
  where latest.is_correct is true
  group by latest.player_id;
end;
$$;

revoke all on function public.get_room_leaderboard(uuid) from public;
grant execute on function public.get_room_leaderboard(uuid) to authenticated;
