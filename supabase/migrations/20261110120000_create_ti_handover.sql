begin;
create schema if not exists ti_private;
revoke all on schema ti_private from public;
grant usage on schema ti_private to authenticated;

create table public.ti_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create function ti_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.ti_members where user_id = auth.uid() and active);
$$;
revoke all on function ti_private.is_member() from public;
grant execute on function ti_private.is_member() to authenticated;

create table public.ti_handover_records (
  id bigint generated always as identity primary key,
  created_by uuid not null references public.ti_members(user_id),
  analyst_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  location text not null check (length(btrim(location)) between 1 and 200),
  problem text not null check (length(btrim(problem)) between 1 and 10000),
  status text not null default 'Aberto' check (status in ('Aberto', 'Em andamento', 'Pendente', 'Resolvido')),
  notes text not null default '' check (length(notes) <= 20000),
  kind text not null default 'ocorrencia' check (kind in ('ocorrencia', 'checklist')),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array')
);
create index ti_handover_date_idx on public.ti_handover_records(occurred_at desc, id desc);
create index ti_handover_analyst_idx on public.ti_handover_records(created_by);

create function ti_private.validate_record() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb; item_id text;
begin
  if TG_OP = 'INSERT' then
    select name into new.analyst_name from public.ti_members where user_id = auth.uid() and active;
    if new.analyst_name is null or new.created_by is distinct from auth.uid() then
      raise exception 'Acesso restrito aos analistas de TI.' using errcode = '42501';
    end if;
    new.created_at := now();
    new.occurred_at := now();
  else
    if new.created_by is distinct from old.created_by or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at or new.analyst_name is distinct from old.analyst_name
      or new.kind is distinct from old.kind or new.checklist is distinct from old.checklist
      or new.occurred_at is distinct from old.occurred_at or new.problem is distinct from old.problem
      or new.location is distinct from old.location then
      raise exception 'A autoria e o checklist original devem ser preservados.';
    end if;
  end if;
  if new.kind = 'checklist' then
    if jsonb_array_length(new.checklist) <> 6 then raise exception 'Checklist incompleto.'; end if;
    foreach item_id in array array['rede','servidores','backups','sistemas','chamados','pendencias'] loop
      if (select count(*) from jsonb_array_elements(new.checklist) x where x->>'id' = item_id) <> 1 then
        raise exception 'Checklist incompleto ou com itens duplicados.';
      end if;
    end loop;
    for item in select * from jsonb_array_elements(new.checklist) loop
      if length(coalesce(item->>'question','')) not between 1 and 1000 or length(coalesce(item->>'notes','')) > 2000 then raise exception 'Item de checklist inválido.'; end if;
      if coalesce(item->>'answer', '') not in ('Conforme','Irregular','Não se aplica') then raise exception 'Responda todos os itens.'; end if;
      if item->>'answer' = 'Irregular' and length(btrim(coalesce(item->>'notes',''))) = 0 then raise exception 'Descreva a irregularidade.'; end if;
    end loop;
  elsif new.checklist <> '[]'::jsonb then raise exception 'Use o formulário de checklist para registrar respostas.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function ti_private.validate_record() from public;
create trigger ti_handover_validate before insert or update on public.ti_handover_records
for each row execute function ti_private.validate_record();

alter table public.ti_members enable row level security;
alter table public.ti_handover_records enable row level security;
revoke all on public.ti_members, public.ti_handover_records from public, anon, authenticated;
grant select on public.ti_members to authenticated;
grant select, insert, update on public.ti_handover_records to authenticated;
grant usage, select on sequence public.ti_handover_records_id_seq to authenticated;
grant all on public.ti_members, public.ti_handover_records to service_role;
grant usage, select on sequence public.ti_handover_records_id_seq to service_role;
create policy ti_members_read on public.ti_members for select to authenticated using (ti_private.is_member());
create policy ti_records_read on public.ti_handover_records for select to authenticated using (ti_private.is_member());
create policy ti_records_insert on public.ti_handover_records for insert to authenticated with check (ti_private.is_member() and created_by = auth.uid());
create policy ti_records_update on public.ti_handover_records for update to authenticated using (ti_private.is_member()) with check (ti_private.is_member());
notify pgrst, 'reload schema';
commit;
