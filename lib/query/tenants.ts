import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Tenant } from '../types';

export function useTenant(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<Tenant> => {
      const { data, error } = await supabase
        .from('tenant')
        .select('*')
        .eq('id', tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
