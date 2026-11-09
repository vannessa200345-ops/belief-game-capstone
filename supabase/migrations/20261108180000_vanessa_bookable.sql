-- Open Vanessa's one-on-one. Andy stays bookable.

update public.teachers
set
  bookable = true,
  summary = 'Quantum healing。認證量子療癒師。現時可預約。',
  summary_en = 'Quantum healing. Certified quantum practitioner. Available now.'
where slug = 'vanessa';
