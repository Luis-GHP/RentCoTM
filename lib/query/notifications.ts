import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type NotificationEvent = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function useNotificationEvents() {
  return useQuery({
    queryKey: ['notification-events'],
    queryFn: async (): Promise<NotificationEvent[]> => {
      const { data, error } = await supabase
        .from('notification_event')
        .select('id, user_id, title, body, data, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as NotificationEvent[];
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notification-events', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notification_event')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_event')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-events'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notification_event')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-events'] });
    },
  });
}
