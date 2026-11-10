begin;
create or replace function ti_private.validate_record() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb; item_id text;
begin
  if TG_OP = 'INSERT' then
    select name into new.analyst_name from public.ti_members where user_id = auth.uid() and active;
    if new.analyst_name is null or new.created_by is distinct from auth.uid() then
      raise exception 'Acesso restrito aos analistas de TI.' using errcode = '42501';
    end if;
    new.created_at := now();
    new.occurred_at := coalesce(new.occurred_at, now());
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
notify pgrst, 'reload schema';
commit;
