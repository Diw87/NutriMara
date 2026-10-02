-- Execute after online.sql + consultorio.sql. All fixtures are rolled back.
begin;
do $$
declare
 batch_id uuid := gen_random_uuid();
 bad_batch_id uuid := gen_random_uuid();
 marker text := gen_random_uuid()::text;
 kept_id bigint;
 first_id bigint;
 second_id bigint;
 count_before bigint;
 added integer;
 duplicate_rejected boolean := false;
 invalid_rejected boolean := false;
 rows jsonb;
 attachment_key text := gen_random_uuid()::text || '.pdf';
begin
 if not (select relrowsecurity from pg_class where oid='public.nutri_records'::regclass)
   or not (select relrowsecurity from pg_class where oid='public.nutri_uploads'::regclass) then raise exception 'RLS must remain enabled'; end if;
 if has_table_privilege('anon','public.nutri_uploads','SELECT') or has_table_privilege('authenticated','public.nutri_uploads','SELECT')
   or has_function_privilege('anon','public.nutri_import(uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.nutri_import(uuid,jsonb)','EXECUTE') then raise exception 'private resources exposed'; end if;
 if not exists(select 1 from storage.buckets where id='nutrimara-documents' and not public and file_size_limit=10485760 and allowed_mime_types @> array['application/pdf','image/png','image/jpeg']) then raise exception 'private bucket configuration missing'; end if;
 if (select prosecdef from pg_proc where oid='public.nutri_import(uuid,jsonb)'::regprocedure) then raise exception 'import must remain security invoker'; end if;

 insert into public.nutri_records(kind,data) values('patients',jsonb_build_object('name','kept-'||marker)) returning id into kept_id;
 select count(*) into count_before from public.nutri_records;
 rows := jsonb_build_object(
  'patients',jsonb_build_array(jsonb_build_object('id',7,'name','first-'||marker,'nickname','Apelido','tags','retorno'),jsonb_build_object('id',8,'name','second-'||marker)),
  'appointments',jsonb_build_array(jsonb_build_object('id',1,'patientId',7)),
  'measurements',jsonb_build_array(jsonb_build_object('id',2,'patientId',8)),
  'plans',jsonb_build_array(jsonb_build_object('id',3,'patientId',7)),
  'photoAssessments',jsonb_build_array(jsonb_build_object('id',4,'patientId',8,'frontKey','server/front.jpg','sideKey','server/side.jpg')),
  'clinicalRecords',jsonb_build_array(jsonb_build_object('id',5,'patientId',7)),
  'clinicalEntries',jsonb_build_array(
   jsonb_build_object('id',21,'_version',9,'patientId',7,'module','labs','title','labs-'||marker,'status','Rascunho','fields',jsonb_build_object('description','Original')),
   jsonb_build_object('id',22,'patientId',8,'module','attachments','title','file-'||marker,'status','Arquivado','fields',jsonb_build_object('description','Preserved'),'attachmentKey',attachment_key,'attachment',jsonb_build_object('name','resultado.pdf','contentType','application/pdf','size',20))
  )
 );
 select public.nutri_import(batch_id,rows) into added;
 if added <> 2 then raise exception 'wrong number of imported patients'; end if;
 select id into first_id from public.nutri_records where kind='patients' and data->>'name'='first-'||marker;
 select id into second_id from public.nutri_records where kind='patients' and data->>'name'='second-'||marker;
 if first_id is null or second_id is null or first_id=second_id or first_id=kept_id or second_id=kept_id then raise exception 'patient remapping missing'; end if;
 if not exists(select 1 from public.nutri_records where kind='clinicalEntries' and data->>'title'='labs-'||marker and (data->>'patientId')::bigint=first_id and data->'fields'->>'description'='Original' and version=1 and not data ? '_version' and not data ? 'id') then raise exception 'clinical entry identity or content lost'; end if;
 if not exists(select 1 from public.nutri_records where kind='clinicalEntries' and data->>'title'='file-'||marker and (data->>'patientId')::bigint=second_id and data->>'attachmentKey'=attachment_key and data->>'status'='Arquivado' and data->'attachment'->>'name'='resultado.pdf') then raise exception 'attachment mapping or archive state lost'; end if;
 if not exists(select 1 from public.nutri_records where kind='photoAssessments' and (data->>'patientId')::bigint=second_id and data->>'frontKey'='server/front.jpg' and data->>'sideKey'='server/side.jpg') then raise exception 'legacy photo mapping lost'; end if;
 if not exists(select 1 from public.nutri_records where id=kept_id and data->>'name'='kept-'||marker) then raise exception 'existing patient changed'; end if;
 if (select count(*) from public.nutri_records) <> count_before+9 then raise exception 'records missing from imported batch'; end if;
 begin perform public.nutri_import(batch_id,rows); exception when unique_violation then duplicate_rejected:=true; end;
 if not duplicate_rejected or (select count(*) from public.nutri_records) <> count_before+9 then raise exception 'duplicate batch changed records'; end if;
 begin
  perform public.nutri_import(bad_batch_id,jsonb_build_object('patients',jsonb_build_array(jsonb_build_object('id',7,'name','bad-'||marker)),'clinicalEntries',jsonb_build_array(jsonb_build_object('id',23,'patientId',999,'module','labs'))));
 exception when sqlstate '22023' then invalid_rejected:=true;
 end;
 if not invalid_rejected or exists(select 1 from public.nutri_imports where id=bad_batch_id) or exists(select 1 from public.nutri_records where data->>'name'='bad-'||marker) then raise exception 'invalid batch was partially imported'; end if;
end $$;
rollback;
