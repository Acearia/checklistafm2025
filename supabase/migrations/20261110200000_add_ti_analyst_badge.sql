begin;
alter table public.ti_members add column badge text null;
alter table public.ti_members add constraint ti_members_badge_format check (badge is null or badge ~ '^[A-Z0-9._-]{1,40}$');
alter table public.ti_members add constraint ti_members_badge_key unique(badge);
notify pgrst,'reload schema';
commit;
