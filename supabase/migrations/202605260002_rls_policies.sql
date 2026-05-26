alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.media_assets enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.project_invitations enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.project_role(_project_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when exists (
      select 1 from public.projects
      where id = _project_id and owner_id = auth.uid()
    ) then 'owner'
    else (
      select pm.role
      from public.project_members pm
      where pm.project_id = _project_id
        and pm.user_id = auth.uid()
      limit 1
    )
  end;
$$;

create or replace function public.can_view_project(_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.project_role(_project_id) in ('owner', 'editor', 'viewer');
$$;

create or replace function public.can_edit_project(_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.project_role(_project_id) in ('owner', 'editor');
$$;

create policy "Users can select own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Project members can select projects"
on public.projects for select
to authenticated
using (public.can_view_project(id));

create policy "Users can create owned projects"
on public.projects for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update projects"
on public.projects for update
to authenticated
using (public.project_role(id) = 'owner')
with check (owner_id = auth.uid());

create policy "Owners can delete projects"
on public.projects for delete
to authenticated
using (public.project_role(id) = 'owner');

create policy "Project members can select memberships"
on public.project_members for select
to authenticated
using (public.can_view_project(project_id));

create policy "Owners can insert memberships"
on public.project_members for insert
to authenticated
with check (public.project_role(project_id) = 'owner');

create policy "Owners can update memberships"
on public.project_members for update
to authenticated
using (public.project_role(project_id) = 'owner')
with check (public.project_role(project_id) = 'owner');

create policy "Owners can delete memberships"
on public.project_members for delete
to authenticated
using (public.project_role(project_id) = 'owner');

create policy "Project members can select media assets"
on public.media_assets for select
to authenticated
using (public.can_view_project(project_id));

create policy "Editors can insert media assets"
on public.media_assets for insert
to authenticated
with check (public.can_edit_project(project_id) and owner_id = auth.uid());

create policy "Editors can update media assets"
on public.media_assets for update
to authenticated
using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

create policy "Editors can delete media assets"
on public.media_assets for delete
to authenticated
using (public.can_edit_project(project_id));

create policy "Project members can select processing jobs"
on public.processing_jobs for select
to authenticated
using (public.can_view_project(project_id));

create policy "Editors can insert processing jobs"
on public.processing_jobs for insert
to authenticated
with check (public.can_edit_project(project_id) and created_by = auth.uid());

create policy "Editors can update processing jobs"
on public.processing_jobs for update
to authenticated
using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

create policy "Owners can manage invitations"
on public.project_invitations for all
to authenticated
using (public.project_role(project_id) = 'owner')
with check (public.project_role(project_id) = 'owner' and invited_by = auth.uid());

create policy "Project members can select audit events"
on public.audit_events for select
to authenticated
using (project_id is not null and public.can_view_project(project_id));
