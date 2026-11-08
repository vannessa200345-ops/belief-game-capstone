-- Close Vanessa's public booking again. Andy stays bookable.
-- Apply this after 20261108180000_vanessa_bookable.sql.

update public.teachers
set
  bookable = false,
  summary = 'Quantum healing。認證量子療癒師。',
  summary_en = 'Quantum healing. Certified quantum practitioner.'
where slug = 'vanessa';
