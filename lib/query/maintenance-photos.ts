import { supabase } from '../supabase';
import { resolveStorageUrl } from '../storage';

export type MaintenancePhotoSummary = {
  thumbnail_url: string | null;
  photo_count: number;
};

type MaintenancePhotoRow = {
  entity_id: string;
  file_url: string;
};

export async function getMaintenancePhotoSummaries(requestIds: string[]) {
  const summaries = new Map<string, MaintenancePhotoSummary>();
  const uniqueIds = Array.from(new Set(requestIds.filter(Boolean)));
  if (uniqueIds.length === 0) return summaries;

  const { data, error } = await supabase
    .from('document')
    .select('entity_id, file_url')
    .eq('entity_type', 'maintenance_request')
    .eq('doc_type', 'photo')
    .in('entity_id', uniqueIds)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.warn('Could not load maintenance request photos', error);
    return summaries;
  }

  const rows = (data ?? []) as MaintenancePhotoRow[];
  for (const row of rows) {
    const current = summaries.get(row.entity_id) ?? { thumbnail_url: null, photo_count: 0 };
    summaries.set(row.entity_id, {
      thumbnail_url: current.thumbnail_url ?? row.file_url,
      photo_count: current.photo_count + 1,
    });
  }

  await Promise.all(Array.from(summaries.entries()).map(async ([requestId, summary]) => {
    if (!summary.thumbnail_url) return;
    summaries.set(requestId, {
      ...summary,
      thumbnail_url: await resolveStorageUrl(summary.thumbnail_url) ?? summary.thumbnail_url,
    });
  }));

  return summaries;
}
