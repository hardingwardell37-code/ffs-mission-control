-- Deterministic, governed task runtime. No autonomous execution or external side effects.

create policy approvals_insert_org on public.approvals for insert to authenticated
with check (public.can_manage_org(organization_id));

create or replace function public.enforce_task_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status::text='draft' and new.status::text in ('queued','cancelled')) or
    (old.status::text='queued' and new.status::text in ('running','blocked','cancelled')) or
    (old.status::text='running' and new.status::text in ('blocked','awaiting_approval','completed','failed','cancelled')) or
    (old.status::text='blocked' and new.status::text in ('queued','cancelled')) or
    (old.status::text='awaiting_approval' and new.status::text in ('running','blocked','completed','cancelled'))
  ) then raise exception 'invalid task transition: % -> %',old.status,new.status; end if;
  return new;
end $$;

create or replace function public.transition_task_runtime(
  p_task_id uuid,
  p_next public.task_status,
  p_summary text default null,
  p_output jsonb default null
) returns public.tasks language plpgsql security invoker set search_path='' as $$
declare v_task public.tasks; v_event_type text; v_approval_statuses text[];
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if v_task.id is null or not public.can_manage_org(v_task.organization_id) then raise exception 'task not found'; end if;

  v_event_type := case p_next::text
    when 'queued' then 'task.queued' when 'running' then 'task.started'
    when 'blocked' then 'task.blocked' when 'failed' then 'task.failed'
    when 'cancelled' then 'task.cancelled' when 'completed' then 'task.completed'
    else null end;
  if v_event_type is null then raise exception 'unsupported runtime transition'; end if;

  select coalesce(array_agg(status::text),array[]::text[]) into v_approval_statuses
  from public.approvals where task_id=p_task_id;
  if p_next::text='completed' and (
    'pending'=any(v_approval_statuses) or
    (cardinality(v_approval_statuses)>0 and not ('approved'=any(v_approval_statuses)))
  ) then raise exception 'task approval is unresolved'; end if;

  if p_next::text='completed' and (
    p_output is null or
    not (p_output ?& array['outputType','title','summary','timestamp']) or
    (select count(*) from jsonb_object_keys(p_output)) <> 4 or
    char_length(p_output->>'outputType') not between 1 and 80 or
    char_length(p_output->>'title') not between 1 and 180 or
    char_length(p_output->>'summary') not between 1 and 1000
  ) then raise exception 'safe completion output is required'; end if;

  update public.tasks set
    status=p_next,
    started_at=case when p_next::text='running' then coalesce(started_at,now()) else started_at end,
    finished_at=case when p_next::text in ('completed','failed','cancelled') then now() else finished_at end,
    error_message=case when p_next::text in ('blocked','failed') then left(p_summary,500) else error_message end,
    output=case when p_next::text='completed' then p_output else output end
  where id=p_task_id returning * into v_task;

  insert into public.audit_events(organization_id,actor_type,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_task.organization_id,'user',auth.uid()::text,v_event_type,'task',v_task.id::text,
    jsonb_strip_nulls(jsonb_build_object('status',p_next::text,'summary',left(p_summary,500),'output',case when p_next::text='completed' then p_output else null end)));
  return v_task;
end $$;

create or replace function public.request_task_runtime_approval(p_task_id uuid,p_action_key text,p_reason text)
returns public.approvals language plpgsql security invoker set search_path='' as $$
declare v_task public.tasks; v_approval public.approvals;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if v_task.id is null or not public.can_manage_org(v_task.organization_id) then raise exception 'task not found'; end if;
  if v_task.status::text <> 'running' then raise exception 'approval may only be requested for a running task'; end if;
  if char_length(trim(p_action_key)) not between 1 and 120 or char_length(trim(p_reason)) not between 1 and 1000 then raise exception 'invalid approval request'; end if;
  if exists(select 1 from public.approvals where task_id=p_task_id and status::text='pending') then raise exception 'task already has a pending approval'; end if;

  insert into public.approvals(task_id,organization_id,action_key,reason,payload)
  values(p_task_id,v_task.organization_id,trim(p_action_key),trim(p_reason),'{}'::jsonb) returning * into v_approval;
  update public.tasks set status='awaiting_approval' where id=p_task_id;
  insert into public.audit_events(organization_id,actor_type,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_task.organization_id,'user',auth.uid()::text,'approval.requested','task',p_task_id::text,jsonb_build_object('approvalId',v_approval.id,'actionKey',v_approval.action_key));
  return v_approval;
end $$;

create or replace function public.record_task_runtime_handoff(p_task_id uuid,p_destination_agent_id uuid,p_summary text)
returns public.tasks language plpgsql security invoker set search_path='' as $$
declare v_task public.tasks; v_source_id uuid; v_source_name text; v_destination_name text;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if v_task.id is null or not public.can_manage_org(v_task.organization_id) then raise exception 'task not found'; end if;
  if v_task.status::text <> 'running' then raise exception 'only running tasks may be handed off'; end if;
  if char_length(trim(p_summary)) not between 1 and 500 then raise exception 'invalid handoff summary'; end if;
  v_source_id := v_task.agent_id;
  select name into v_source_name from public.agents where id=v_source_id and organization_id=v_task.organization_id;
  select name into v_destination_name from public.agents where id=p_destination_agent_id and organization_id=v_task.organization_id and status::text='active' and archived_at is null;
  if v_destination_name is null then raise exception 'destination agent is unavailable'; end if;

  update public.tasks set agent_id=p_destination_agent_id where id=p_task_id returning * into v_task;
  insert into public.audit_events(organization_id,actor_type,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_task.organization_id,'user',auth.uid()::text,'task.handoff','task',v_task.id::text,jsonb_build_object(
    'sourceAgentId',v_source_id,'sourceAgentName',v_source_name,
    'destinationAgentId',p_destination_agent_id,'destinationAgentName',v_destination_name,
    'summary',trim(p_summary),'timestamp',now()
  ));
  return v_task;
end $$;

revoke all on function public.transition_task_runtime(uuid,public.task_status,text,jsonb) from public;
revoke all on function public.request_task_runtime_approval(uuid,text,text) from public;
revoke all on function public.record_task_runtime_handoff(uuid,uuid,text) from public;
grant execute on function public.transition_task_runtime(uuid,public.task_status,text,jsonb) to authenticated;
grant execute on function public.request_task_runtime_approval(uuid,text,text) to authenticated;
grant execute on function public.record_task_runtime_handoff(uuid,uuid,text) to authenticated;
