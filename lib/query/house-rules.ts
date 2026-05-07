import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type HouseRuleCategory =
  | 'general'
  | 'payment'
  | 'maintenance'
  | 'utilities'
  | 'visitors'
  | 'parking'
  | 'quiet_hours'
  | 'safety'
  | 'move_out'
  | 'other';

export type HouseRuleProperty = {
  id: string;
  name: string;
  address: string;
};

export type HouseRule = {
  id: string;
  property_id: string;
  title: string;
  body: string;
  category: HouseRuleCategory;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  property: HouseRuleProperty | null;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeRule(row: any): HouseRule {
  return {
    ...row,
    property: normalizeOne(row.property),
  } as HouseRule;
}

export function useHouseRuleProperties() {
  return useQuery({
    queryKey: ['house-rule-properties'],
    queryFn: async (): Promise<HouseRuleProperty[]> => {
      const { data, error } = await supabase
        .from('property')
        .select('id, name, address')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as HouseRuleProperty[];
    },
  });
}

export function useLandlordHouseRules(propertyId: string | null = null) {
  return useQuery({
    queryKey: ['house-rules', 'landlord', propertyId ?? 'all'],
    queryFn: async (): Promise<HouseRule[]> => {
      let query = supabase
        .from('house_rule')
        .select(`
          id, property_id, title, body, category, is_published,
          sort_order, created_at, updated_at,
          property:property_id (id, name, address)
        `)
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });

      if (propertyId) query = query.eq('property_id', propertyId);

      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as any[]).map(normalizeRule);
    },
  });
}

export function useTenantHouseRules() {
  return useQuery({
    queryKey: ['house-rules', 'tenant'],
    queryFn: async (): Promise<HouseRule[]> => {
      const { data, error } = await supabase
        .from('house_rule')
        .select(`
          id, property_id, title, body, category, is_published,
          sort_order, created_at, updated_at,
          property:property_id (id, name, address)
        `)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map(normalizeRule);
    },
  });
}

export function useSaveHouseRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string | null;
      propertyId: string;
      title: string;
      body: string;
      category: HouseRuleCategory;
      isPublished: boolean;
      sortOrder?: number;
    }) => {
      const payload = {
        property_id: params.propertyId,
        title: params.title.trim(),
        body: params.body.trim(),
        category: params.category,
        is_published: params.isPublished,
        sort_order: params.sortOrder ?? 0,
      };

      if (params.id) {
        const { error } = await supabase.from('house_rule').update(payload).eq('id', params.id);
        if (error) throw error;
        return params.id;
      }

      const { data, error } = await supabase.from('house_rule').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['house-rules'] });
    },
  });
}

export function useSetHouseRulePublished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; isPublished: boolean }) => {
      const { error } = await supabase
        .from('house_rule')
        .update({ is_published: params.isPublished })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['house-rules'] });
    },
  });
}

export function useDeleteHouseRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('house_rule').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['house-rules'] });
    },
  });
}
