import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type MaintenanceRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  unit: { unit_number: string; property: { name: string } | null } | null;
};

type Filter = 'all' | 'open' | 'in_progress' | 'resolved';

export function useMaintenanceRequests(filter: Filter = 'all') {
  return useQuery({
    queryKey: ['maintenance-requests', filter],
    queryFn: async (): Promise<MaintenanceRow[]> => {
      let query = supabase
        .from('maintenance_request')
        .select(`
          id, title, category, priority, status, created_at, resolved_at,
          unit:unit_id (unit_number, property:property_id (name))
        `)
        .order('created_at', { ascending: false });

      if (filter === 'open')        query = query.in('status', ['open', 'assigned']);
      if (filter === 'in_progress') query = query.eq('status', 'in_progress');
      if (filter === 'resolved')    query = query.in('status', ['resolved', 'closed']);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MaintenanceRow[];
    },
  });
}
