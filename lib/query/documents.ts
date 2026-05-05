import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type DocumentEntityType = 'rent_payment' | 'utility_bill' | 'maintenance_request' | 'tenant' | 'lease';
export type DocumentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  sort_order: number | null;
  area_tag: string | null;
  caption: string | null;
  uploaded_by: 'landlord' | 'tenant';
  uploaded_at: string;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '-');
}

export async function uploadDocumentFile(params: {
  uri: string;
  fileName: string;
  contentType?: string;
  pathPrefix: string;
}) {
  const response = await fetch(params.uri);
  const blob = await response.blob();
  const path = `${params.pathPrefix}/${Date.now()}-${safeFileName(params.fileName)}`;
  const { error } = await supabase.storage.from('documents').upload(path, blob, {
    contentType: params.contentType || blob.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;
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
      return (data ?? []) as DocumentRow[];
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      entityType: DocumentEntityType;
      entityId: string;
      docType: string;
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
      if (error) throw error;
      return data as DocumentRow;
    },
    onSuccess: doc => {
      queryClient.invalidateQueries({ queryKey: ['documents', doc.entity_type, doc.entity_id] });
    },
  });
}
