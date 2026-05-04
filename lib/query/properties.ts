import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type PropertyWithUnits = {
  id: string;
  name: string;
  address: string;
  electric_provider: string | null;
  default_rate_per_kwh: number | null;
  created_at: string;
  unit: { id: string; status: string }[];
};

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async (): Promise<PropertyWithUnits[]> => {
      const { data, error } = await supabase
        .from('property')
        .select('id, name, address, electric_provider, default_rate_per_kwh, created_at, unit(id, status)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PropertyWithUnits[];
    },
  });
}
