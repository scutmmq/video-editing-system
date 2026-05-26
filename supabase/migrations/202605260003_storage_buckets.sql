insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-originals', 'media-originals', false, 524288000, array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']),
  ('media-results', 'media-results', false, 524288000, array['video/mp4', 'video/webm']),
  ('media-derived', 'media-derived', false, 104857600, array['image/gif', 'image/png', 'audio/mpeg', 'audio/wav', 'audio/webm']),
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read own private media objects"
on storage.objects for select
to authenticated
using (
  bucket_id in ('media-originals', 'media-results', 'media-derived')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own private media objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('media-originals', 'media-results', 'media-derived')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own private media objects"
on storage.objects for update
to authenticated
using (
  bucket_id in ('media-originals', 'media-results', 'media-derived')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('media-originals', 'media-results', 'media-derived')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own private media objects"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('media-originals', 'media-results', 'media-derived')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Anyone can read avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Users can upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
