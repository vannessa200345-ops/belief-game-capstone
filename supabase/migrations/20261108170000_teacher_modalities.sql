-- Name each teacher's modality. Booking availability is unchanged:
-- Andy stays bookable; Vanessa stays closed until bookable is set true.

update public.teachers
set
  summary = '希塔療癒。現時可預約。',
  summary_en = 'Theta Healing. Available now.'
where slug = 'andy';

update public.teachers
set
  summary = 'Quantum healing。認證量子療癒師。稍後開放。',
  summary_en = 'Quantum healing. Certified quantum practitioner. Opens later.'
where slug = 'vanessa';
