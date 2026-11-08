-- Show teachers who are not yet bookable, so the booking page can mark them as later.
-- Scoring and room caps are unchanged.

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
      where s.kind = 'group'
        and s.status <> 'cancelled'
        and s.starts_at > now() - interval '12 hours'
    ), '[]'::jsonb)
  );
$$;
