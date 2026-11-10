begin;
create table public.ti_computer_questions (
  id text primary key default gen_random_uuid()::text,
  label text not null check (length(btrim(label)) between 1 and 500),
  position integer not null default 0,
  active boolean not null default true
);
insert into public.ti_computer_questions(id,label,position) values
 ('domain','Adicionado ao Domínio',1), ('office','Office instalado',2),
 ('office-account','Conta do Office configurada corretamente',3), ('email','E-mail do usuário adicionado',4),
 ('spark','Spark instalado',5), ('filemaker','FileMaker instalado',6),
 ('glpi','GLPI na área de trabalho',7), ('rustdesk','RustDesk instalado',8),
 ('rustdesk-config','RustDesk configurado',9), ('rustdesk-group','Número do RustDesk colocado no grupo',10),
 ('antivirus','Antivírus instalado',11), ('antivirus-server','Antivírus conectado ao servidor',12),
 ('uses-teams','Usuário usa Teams',13), ('teams-config','Teams configurado',14),
 ('uses-powerbi','Usuário usa Power BI',15), ('powerbi-config','Power BI configurado',16),
 ('uses-vpn','Usuário usa VPN',17), ('vpn-config','VPN configurada',18),
 ('reader','Adobe Reader instalado',19), ('printer','Impressora configurada',20),
 ('folders','Pastas do usuário estão aparecendo',21), ('extra-software','Usuário usa software adicional',22);

create table public.ti_computer_checklists (
  id bigint generated always as identity primary key,
  created_by uuid not null references public.ti_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  computer text not null check (length(btrim(computer)) between 1 and 100),
  user_name text not null check (length(btrim(user_name)) between 1 and 200),
  analyst_id uuid not null references public.ti_members(user_id),
  analyst_name text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  additional_software text not null default '' check (length(additional_software) <= 5000),
  notes text not null default '' check (length(notes) <= 20000)
);
create index ti_computer_checklists_date_idx on public.ti_computer_checklists(created_at desc,id desc);
create index ti_computer_checklists_analyst_idx on public.ti_computer_checklists(analyst_id);

create function ti_private.validate_computer_checklist() returns trigger
language plpgsql set search_path = '' as $$
declare item jsonb; original jsonb; question_row record; ids text[] := array[]::text[];
begin
  if TG_OP = 'INSERT' then
    if new.created_by is distinct from auth.uid() then raise exception 'Autoria inválida.' using errcode='42501'; end if;
    new.created_at := now();
  else
    if new.created_by is distinct from old.created_by or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'A autoria deve ser preservada.';
    end if;
    for original in select * from jsonb_array_elements(old.answers) loop
      if not exists(select 1 from jsonb_array_elements(new.answers) x where x->>'id'=original->>'id' and x->>'question'=original->>'question' and coalesce(x->>'custom','false')=coalesce(original->>'custom','false')) then
        raise exception 'As perguntas originais devem ser preservadas.';
      end if;
    end loop;
  end if;
  if TG_OP='INSERT' or new.analyst_id is distinct from old.analyst_id then
    select name into new.analyst_name from public.ti_members where user_id=new.analyst_id and active;
    if new.analyst_name is null then raise exception 'Selecione um analista ativo.'; end if;
  else new.analyst_name := old.analyst_name;
  end if;
  if jsonb_array_length(new.answers) not between 1 and 200 then raise exception 'Quantidade de perguntas inválida.'; end if;
  for item in select * from jsonb_array_elements(new.answers) loop
    if coalesce(item->>'id','')='' or item->>'id'=any(ids) or coalesce(jsonb_typeof(item->'answer'),'')<>'boolean'
      or length(btrim(coalesce(item->>'question',''))) not between 1 and 500 then raise exception 'Resposta inválida ou duplicada.'; end if;
    ids := array_append(ids,item->>'id');
    if TG_OP='INSERT' then
      if coalesce(item->>'custom','false')='true' then
        if item->>'id' not like 'custom-%' then raise exception 'Pergunta adicional inválida.'; end if;
      elsif not exists(select 1 from public.ti_computer_questions q where q.id=item->>'id' and q.active and q.label=item->>'question') then
        raise exception 'As perguntas foram atualizadas. Atualize o formulário antes de salvar.';
      end if;
    elsif not exists(select 1 from jsonb_array_elements(old.answers) x where x->>'id'=item->>'id') then
      if coalesce(item->>'custom','false')<>'true' or item->>'id' not like 'custom-%' then raise exception 'Somente perguntas adicionais podem ser incluídas na edição.'; end if;
    end if;
    if item->>'id'='extra-software' and (item->>'answer')::boolean and length(btrim(new.additional_software))=0 then raise exception 'Detalhe o software adicional.'; end if;
  end loop;
  if TG_OP='INSERT' then
    for question_row in select id from public.ti_computer_questions where active loop
      if not question_row.id=any(ids) then raise exception 'O checklist precisa conter todas as perguntas ativas.'; end if;
    end loop;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function ti_private.validate_computer_checklist() from public;
create trigger ti_computer_checklist_validate before insert or update on public.ti_computer_checklists
for each row execute function ti_private.validate_computer_checklist();

alter table public.ti_computer_questions enable row level security;
alter table public.ti_computer_checklists enable row level security;
revoke all on public.ti_computer_questions,public.ti_computer_checklists from public,anon,authenticated;
grant select,insert,update on public.ti_computer_questions,public.ti_computer_checklists to authenticated;
grant usage,select on sequence public.ti_computer_checklists_id_seq to authenticated,service_role;
grant all on public.ti_computer_questions,public.ti_computer_checklists to service_role;
create policy ti_questions_read on public.ti_computer_questions for select to authenticated using (ti_private.is_member());
create policy ti_questions_insert on public.ti_computer_questions for insert to authenticated with check (ti_private.is_member());
create policy ti_questions_update on public.ti_computer_questions for update to authenticated using (ti_private.is_member()) with check (ti_private.is_member());
create policy ti_computer_read on public.ti_computer_checklists for select to authenticated using (ti_private.is_member());
create policy ti_computer_insert on public.ti_computer_checklists for insert to authenticated with check (ti_private.is_member() and created_by=auth.uid());
create policy ti_computer_update on public.ti_computer_checklists for update to authenticated using (ti_private.is_member() and created_by=auth.uid()) with check (ti_private.is_member() and created_by=auth.uid());
notify pgrst,'reload schema';
commit;
