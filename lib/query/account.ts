import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useUpdateLandlordProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { landlordId: string; name: string; email: string; phone: string | null }) => {
      const { error } = await supabase
        .from('landlord')
        .update({
          name: params.name.trim(),
          email: params.email.trim().toLowerCase(),
          phone: params.phone?.trim() || null,
        })
        .eq('id', params.landlordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-info'] });
    },
  });
}
