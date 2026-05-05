-- ============================================================
-- MIGRATION 006
-- Storage buckets and object policies for app uploads.
--
-- The current mobile app stores Supabase public URLs for source PDFs,
-- receipts, OR PDFs, and general documents. Buckets are therefore
-- public-readable, while writes remain restricted to signed-in users.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', true, 10485760, null),
  ('utility-bills', 'utility-bills', true, 10485760, array['application/pdf']),
  ('receipts', 'receipts', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('or-pdfs', 'or-pdfs', true, 10485760, array['application/pdf'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public: read rentco storage files" on storage.objects;
create policy "public: read rentco storage files"
  on storage.objects for select
  using (bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs'));

drop policy if exists "authenticated: upload rentco storage files" on storage.objects;
create policy "authenticated: upload rentco storage files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs'));

drop policy if exists "authenticated: update own rentco storage files" on storage.objects;
create policy "authenticated: update own rentco storage files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs')
    and owner = auth.uid()
  )
  with check (
    bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs')
    and owner = auth.uid()
  );

drop policy if exists "authenticated: delete own rentco storage files" on storage.objects;
create policy "authenticated: delete own rentco storage files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('documents', 'utility-bills', 'receipts', 'or-pdfs')
    and owner = auth.uid()
  );
