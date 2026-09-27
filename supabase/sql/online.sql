create table public.nutri_access (
 alias text primary key, email text not null unique, user_id uuid unique references auth.users(id), enabled boolean not null default true
);
alter table public.nutri_access enable row level security;
revoke all on public.nutri_access from anon, authenticated;
create table public.nutri_records (
 id bigint generated always as identity primary key,
 kind text not null check (kind in ('patients','appointments','measurements','plans','photoAssessments','clinicalRecords')),
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
create index nutri_records_kind_idx on public.nutri_records(kind);
alter table public.nutri_records enable row level security;
revoke all on public.nutri_records from anon, authenticated;
create table public.nutri_imports (id uuid primary key, created_at timestamptz not null default now());
alter table public.nutri_imports enable row level security;
revoke all on public.nutri_imports from anon, authenticated;
create table public.nutri_limits (key text primary key, count integer not null, window_start timestamptz not null);
alter table public.nutri_limits enable row level security;
revoke all on public.nutri_limits from anon, authenticated;
create function public.nutri_rate_limit(p_key text, p_seconds integer, p_max integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 insert into public.nutri_limits as l(key,count,window_start) values(p_key,1,now())
 on conflict(key) do update set count=case when l.window_start < now()-make_interval(secs=>p_seconds) then 1 else l.count+1 end,
 window_start=case when l.window_start < now()-make_interval(secs=>p_seconds) then now() else l.window_start end
 returning count into n;
 return n<=p_max;
end $$;
revoke all on function public.nutri_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.nutri_rate_limit(text,integer,integer) to service_role;
create function public.nutri_import(p_id uuid, p_rows jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; new_id bigint; old_id text; links jsonb := '{}'::jsonb; d jsonb; k text; added integer := 0;
begin
 insert into public.nutri_imports(id) values(p_id);
 for item in select value from jsonb_array_elements(p_rows->'patients') loop
  old_id := item->>'id';
  insert into public.nutri_records(kind,data) values('patients',item-'id'-'_version') returning id into new_id;
  links := links || jsonb_build_object(old_id,new_id); added:=added+1;
 end loop;
 foreach k in array array['appointments','measurements','plans','photoAssessments','clinicalRecords'] loop
  for item in select value from jsonb_array_elements(coalesce(p_rows->k,'[]'::jsonb)) loop
   if links->(item->>'patientId') is null then raise exception 'invalid patient reference'; end if;
   d := (item-'id'-'_version') || jsonb_build_object('patientId',links->(item->>'patientId'));
   insert into public.nutri_records(kind,data) values(k,d);
  end loop;
 end loop;
 return added;
end $$;
revoke all on function public.nutri_import(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nutri_import(uuid,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('nutrimara-private','nutrimara-private',false,4194304,array['image/jpeg']);

create unique index if not exists nutri_one_plan on public.nutri_records(kind,(data->>'patientId')) where kind in ('plans','clinicalRecords');
