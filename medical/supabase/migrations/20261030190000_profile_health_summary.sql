-- Emergency / clinical summary fields on each person profile.

alter table public.profiles
  add column if not exists allergies text
    check (allergies is null or char_length(allergies) <= 1000);

alter table public.profiles
  add column if not exists chronic_conditions text
    check (chronic_conditions is null or char_length(chronic_conditions) <= 1000);

alter table public.profiles
  add column if not exists current_medications text
    check (current_medications is null or char_length(current_medications) <= 1000);

alter table public.profiles
  add column if not exists blood_type text
    check (
      blood_type is null
      or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    );

alter table public.profiles
  add column if not exists emergency_notes text
    check (emergency_notes is null or char_length(emergency_notes) <= 500);
