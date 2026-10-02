-- Additive expansion for consultorio modules and private documents.
begin;
alter table public.nutri_records drop constraint if exists nutri_records_kind_check;
alter table public.nutri_records add constraint nutri_records_kind_check
 check (kind in ('patients','appointments','measurements','plans','photoAssessments','clinicalRecords','clinicalEntries'));

-- Reservations survive a stopped Edge Function; cleanup checks live references first.
create table if not exists public.nutri_uploads (
 id uuid primary key,
 files jsonb not null check (jsonb_typeof(files)='array' and jsonb_array_length(files)>0),
 created_at timestamptz not null default now()
);
alter table public.nutri_uploads enable row level security;
revoke all on public.nutri_uploads from public,anon,authenticated;
grant select,insert,delete on public.nutri_uploads to service_role;
create index if not exists nutri_uploads_created_idx on public.nutri_uploads(created_at);
create unique index if not exists nutri_document_key on public.nutri_records((data->>'attachmentKey')) where kind='clinicalEntries';
create index if not exists nutri_photo_front_key on public.nutri_records((data->>'frontKey')) where kind='photoAssessments';
create index if not exists nutri_photo_side_key on public.nutri_records((data->>'sideKey')) where kind='photoAssessments';

create or replace function public.nutri_import(p_id uuid,p_rows jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; new_id bigint; old_id text; links jsonb := '{}'::jsonb; d jsonb; k text; values_for_kind jsonb; added integer := 0;
begin
 if jsonb_typeof(p_rows) is distinct from 'object' or jsonb_typeof(p_rows->'patients') is distinct from 'array' then raise exception 'invalid workspace' using errcode='22023'; end if;
 insert into public.nutri_imports(id) values(p_id);
 for item in select value from jsonb_array_elements(p_rows->'patients') loop
  old_id := item->>'id';
  if old_id is null or old_id !~ '^[1-9][0-9]*$' or links ? old_id then raise exception 'invalid patient identity' using errcode='22023'; end if;
  insert into public.nutri_records(kind,data) values('patients',item-'id'-'_version') returning id into new_id;
  links := links || jsonb_build_object(old_id,new_id); added:=added+1;
 end loop;
 foreach k in array array['appointments','measurements','plans','photoAssessments','clinicalRecords','clinicalEntries'] loop
  values_for_kind := coalesce(p_rows->k,'[]'::jsonb);
  if jsonb_typeof(values_for_kind) is distinct from 'array' then raise exception 'invalid record collection' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(values_for_kind) loop
   if links->(item->>'patientId') is null then raise exception 'invalid patient reference' using errcode='22023'; end if;
   d := (item-'id'-'_version') || jsonb_build_object('patientId',links->(item->>'patientId'));
   insert into public.nutri_records(kind,data) values(k,d);
  end loop;
 end loop;
 return added;
end $$;
revoke all on function public.nutri_import(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nutri_import(uuid,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('nutrimara-documents','nutrimara-documents',false,10485760,array['application/pdf','image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
