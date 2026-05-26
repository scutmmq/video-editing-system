create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_status_check check (status in ('draft', 'active', 'archived'))
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint project_members_role_check check (role in ('owner', 'editor', 'viewer')),
  unique(project_id, user_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  bucket text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  constraint media_assets_kind_check check (
    kind in (
      'source_video',
      'trimmed_video',
      'gif',
      'audio',
      'cover_image',
      'watermarked_video',
      'filtered_video'
    )
  ),
  unique(bucket, storage_path)
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_asset_id uuid references public.media_assets(id) on delete set null,
  result_asset_id uuid references public.media_assets(id) on delete set null,
  operation text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint processing_jobs_operation_check check (
    operation in ('trim', 'gif', 'extract_audio', 'watermark', 'filter', 'capture_cover')
  ),
  constraint processing_jobs_status_check check (
    status in ('queued', 'processing', 'succeeded', 'failed', 'cancelled')
  )
);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email citext not null,
  role text not null,
  token_hash text not null,
  status text not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint project_invitations_role_check check (role in ('editor', 'viewer')),
  constraint project_invitations_status_check check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects(owner_id);
create index project_members_project_id_idx on public.project_members(project_id);
create index project_members_user_id_idx on public.project_members(user_id);
create index media_assets_project_id_idx on public.media_assets(project_id);
create index media_assets_owner_id_idx on public.media_assets(owner_id);
create index media_assets_kind_idx on public.media_assets(kind);
create index processing_jobs_project_id_idx on public.processing_jobs(project_id);
create index processing_jobs_status_idx on public.processing_jobs(status);
create index processing_jobs_created_by_created_at_idx on public.processing_jobs(created_by, created_at desc);
create index project_invitations_project_id_idx on public.project_invitations(project_id);
create index project_invitations_email_idx on public.project_invitations(email);
create index audit_events_project_id_created_at_idx on public.audit_events(project_id, created_at desc);
