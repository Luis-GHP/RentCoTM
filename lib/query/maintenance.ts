import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { notifyTenantsForMaintenanceRequest } from '../notifications';
import { getMaintenancePhotoSummaries } from './maintenance-photos';

export type MaintenanceRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  unit: { id: string; unit_number: string; property: { name: string } | null } | null;
  thumbnail_url: string | null;
  photo_count: number;
};

export type MaintenanceFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

export function useMaintenanceRequests(filter: MaintenanceFilter = 'all') {
  return useQuery({
    queryKey: ['maintenance-requests', filter],
    queryFn: async (): Promise<MaintenanceRow[]> => {
      let query = supabase
        .from('maintenance_request')
        .select(`
          id, title, category, priority, status, created_at, resolved_at,
          unit:unit_id (id, unit_number, property:property_id (name))
        `)
        .order('created_at', { ascending: false });

      if (filter === 'open')        query = query.in('status', ['open', 'assigned']);
      if (filter === 'in_progress') query = query.eq('status', 'in_progress');
      if (filter === 'resolved')    query = query.eq('status', 'resolved');
      if (filter === 'closed')      query = query.eq('status', 'closed');

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Omit<MaintenanceRow, 'thumbnail_url' | 'photo_count'>[];
      const photos = await getMaintenancePhotoSummaries(rows.map(row => row.id));
      return rows.map(row => ({
        ...row,
        thumbnail_url: photos.get(row.id)?.thumbnail_url ?? null,
        photo_count: photos.get(row.id)?.photo_count ?? 0,
      }));
    },
  });
}

export type MaintenanceDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  unit: {
    id: string;
    unit_number: string;
    property: { id: string; name: string } | null;
  } | null;
  tenant: { id: string; name: string } | null;
};

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export function useMaintenanceRequest(id?: string) {
  return useQuery({
    queryKey: ['maintenance-request', id],
    enabled: !!id,
    queryFn: async (): Promise<MaintenanceDetail> => {
      const { data, error } = await supabase
        .from('maintenance_request')
        .select(`
          id, title, description, category, priority, status, created_at, resolved_at,
          unit:unit_id (id, unit_number, property:property_id (id, name)),
          tenant:reported_by (id, name)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as MaintenanceDetail;
    },
  });
}

export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceStatus }) => {
      const { error } = await withTimeout(
        supabase.rpc('update_maintenance_status', {
          p_request_id: id,
          p_status: status,
        }),
        15000,
        'Status update timed out. Reload and try again.'
      );
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', id] });
      void notifyTenantsForMaintenanceRequest(id, {
        title: 'Maintenance updated',
        body: status === 'resolved'
          ? 'Your maintenance request was marked fixed. Please confirm if everything looks good.'
          : status === 'closed'
            ? 'Your maintenance request was closed.'
            : 'Your maintenance request status was updated.',
        data: { type: 'maintenance_status', route: `/(tenant)/maintenance/${id}`, maintenance_id: id, status },
      });
    },
  });
}
