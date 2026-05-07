import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File as ExpoFile } from 'expo-file-system';
import { supabase } from '../supabase';
import { createStorageRef, parseStorageLocation, resolveStorageUrl } from '../storage';

export type DocumentEntityType =
  | 'rent_payment'
  | 'utility_bill'
  | 'maintenance_request'
  | 'tenant'
  | 'lease'
  | 'inspection'
  | 'expense'
  | 'property'
  | 'unit';

export type DocumentDocType =
  | 'photo'
  | 'contract'
  | 'gov_id'
  | 'gov_id_front'
  | 'gov_id_back'
  | 'receipt'
  | 'bill'
  | 'inspection_report'
  | 'or_pdf'
  | 'utility_bill_pdf'
  | 'other';

export type DocumentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  doc_type: DocumentDocType;
  file_url: string;
  file_name: string | null;
  sort_order: number | null;
  area_tag: string | null;
  caption: string | null;
  uploaded_by: 'landlord' | 'tenant';
  uploaded_at: string;
};

export type DocumentCenterFilter = 'all' | 'receipts' | 'bills' | 'maintenance' | 'ids' | 'official' | 'other';

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/\.{2,}/g, '.').replace(/^\.+/, 'file-');
}

function contentTypeForFile(fileName: string, fallback?: string) {
  if (fallback) return fallback;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 30000) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function loadFileArrayBuffer(uri: string) {
  try {
    const file = new ExpoFile(uri);
    const arrayBuffer = await withTimeout(file.arrayBuffer(), 'The selected file took too long to read.');
    if (arrayBuffer.byteLength > 0) return arrayBuffer;
  } catch {
    // Web blob/content URIs can still work through fetch, so fall through.
  }

  const response = await withTimeout(fetch(uri), 'The selected file took too long to open.');
  const arrayBuffer = await withTimeout(response.arrayBuffer(), 'The selected file took too long to read.');
  if (arrayBuffer.byteLength === 0) {
    throw new Error('The selected file is empty. Pick the original file and try again.');
  }
  return arrayBuffer;
}

export async function uploadDocumentFile(params: {
  uri: string;
  fileName: string;
  contentType?: string;
  pathPrefix: string;
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to upload documents.');

  const arrayBuffer = await loadFileArrayBuffer(params.uri);
  const path = `users/${user.id}/${params.pathPrefix}/${Date.now()}-${safeFileName(params.fileName)}`;
  const { error } = await withTimeout(
    supabase.storage.from('documents').upload(path, arrayBuffer, {
      contentType: contentTypeForFile(params.fileName, params.contentType),
      upsert: false,
    }),
    'Upload took too long. Check your connection and try again.'
  );
  if (error) throw error;
  return createStorageRef('documents', path);
}

async function resolveDocumentRow(row: DocumentRow): Promise<DocumentRow> {
  return {
    ...row,
    file_url: await resolveStorageUrl(row.file_url) ?? row.file_url,
  };
}

async function resolveDocumentRows(rows: DocumentRow[]) {
  return Promise.all(rows.map(resolveDocumentRow));
}

export function useDocumentsForEntity(entityType?: DocumentEntityType, entityId?: string) {
  return useQuery({
    queryKey: ['documents', entityType, entityId],
    enabled: !!entityType && !!entityId,
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from('document')
        .select('id, entity_type, entity_id, doc_type, file_url, file_name, sort_order, area_tag, caption, uploaded_by, uploaded_at')
        .eq('entity_type', entityType!)
        .eq('entity_id', entityId!)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return resolveDocumentRows((data ?? []) as DocumentRow[]);
    },
  });
}

export function useDocumentCenterDocuments() {
  return useQuery({
    queryKey: ['document-center'],
    queryFn: async (): Promise<DocumentRow[]> => {
      const { data, error } = await supabase
        .from('document')
        .select('id, entity_type, entity_id, doc_type, file_url, file_name, sort_order, area_tag, caption, uploaded_by, uploaded_at')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return resolveDocumentRows((data ?? []) as DocumentRow[]);
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      entityType: DocumentEntityType;
      entityId: string;
      docType: DocumentDocType;
      uri: string;
      fileName: string;
      contentType?: string;
      uploadedBy: 'landlord' | 'tenant';
      sortOrder?: number | null;
      caption?: string | null;
    }) => {
      const fileUrl = await uploadDocumentFile({
        uri: params.uri,
        fileName: params.fileName,
        contentType: params.contentType,
        pathPrefix: `${params.entityType}/${params.entityId}`,
      });
      const { data, error } = await supabase
        .from('document')
        .insert({
          entity_type: params.entityType,
          entity_id: params.entityId,
          doc_type: params.docType,
          file_url: fileUrl,
          file_name: params.fileName,
          sort_order: params.sortOrder ?? null,
          caption: params.caption ?? null,
          uploaded_by: params.uploadedBy,
        })
        .select('id, entity_type, entity_id, doc_type, file_url, file_name, sort_order, area_tag, caption, uploaded_by, uploaded_at')
        .single();
      if (error) {
        const uploadedFile = parseStorageLocation(fileUrl);
        if (uploadedFile) {
          const { error: cleanupError } = await supabase.storage
            .from(uploadedFile.bucket)
            .remove([uploadedFile.path]);
          if (cleanupError) console.warn('Could not clean up failed document upload', cleanupError);
        }
        throw error;
      }
      return resolveDocumentRow(data as DocumentRow);
    },
    onSuccess: doc => {
      queryClient.setQueryData<DocumentRow[]>(['documents', doc.entity_type, doc.entity_id], current => {
        const existing = current ?? [];
        if (existing.some(item => item.id === doc.id)) return existing;
        return [doc, ...existing];
      });
      queryClient.invalidateQueries({ queryKey: ['documents', doc.entity_type, doc.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['document-center'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      const { data: deletedFileUrl, error } = await supabase.rpc('delete_document_upload', {
        p_document_id: doc.id,
      });
      if (error) throw error;

      const uploadedFile = parseStorageLocation(typeof deletedFileUrl === 'string' ? deletedFileUrl : doc.file_url);
      if (uploadedFile) {
        const { error: storageError } = await supabase.storage
          .from(uploadedFile.bucket)
          .remove([uploadedFile.path]);
        if (storageError) console.warn('Could not remove deleted document file', storageError);
      }

      return doc;
    },
    onSuccess: doc => {
      queryClient.setQueryData<DocumentRow[]>(['documents', doc.entity_type, doc.entity_id], current => (
        current ? current.filter(item => item.id !== doc.id) : current
      ));
      queryClient.invalidateQueries({ queryKey: ['documents', doc.entity_type, doc.entity_id] });
      queryClient.invalidateQueries({ queryKey: ['document-center'] });
    },
  });
}
