-- Name each teacher's modality. Both are bookable.

update public.teachers
set
  summary = '希塔療癒。現時可預約。',
  summary_en = 'Theta Healing. Available now.',
  bookable = true
where slug = 'andy';

update public.teachers
set
  summary = 'Quantum healing。認證量子療癒師。現時可預約。',
  summary_en = 'Quantum healing. Certified quantum practitioner. Available now.',
  bookable = true
where slug = 'vanessa';
