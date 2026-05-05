import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type PropertyType = 'apartment' | 'house' | 'condo' | 'boarding_house' | 'commercial';
export type ElectricProvider = 'meralco' | 'veco' | 'dlpc' | 'beneco' | 'neeco' | 'manual';
export type UnitType = 'studio' | '1br' | '2br' | '3br' | 'room' | 'bedspace' | 'whole_unit';

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

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      address: string;
      type: PropertyType;
      electricProvider: ElectricProvider;
      defaultRatePerKwh: number | null;
    }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You must be signed in to add a property.');

      const { data: profile, error: profileError } = await supabase
        .from('user_profile')
        .select('landlord_id')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.landlord_id) throw new Error('Landlord profile not found.');

      const { data, error } = await supabase
        .from('property')
        .insert({
          landlord_id: profile.landlord_id,
          name: params.name.trim(),
          address: params.address.trim(),
          type: params.type,
          electric_provider: params.electricProvider,
          default_rate_per_kwh: params.defaultRatePerKwh,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: id => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
    },
  });
}

export type UnitSummary = {
  id: string;
  unit_number: string;
  type: string | null;
  floor: string | null;
  monthly_rent: number;
  status: string;
  lease: {
    id: string;
    status: string;
    lease_tenant: { role: string; tenant: { id: string; name: string } | null }[];
  }[];
};

export type PropertyDetail = {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  electric_provider: string | null;
  default_rate_per_kwh: number | null;
  unit: UnitSummary[];
};

export function useProperty(id?: string) {
  return useQuery({
    queryKey: ['property', id],
    enabled: !!id,
    queryFn: async (): Promise<PropertyDetail> => {
      const { data, error } = await supabase
        .from('property')
        .select(`
          id, name, address, type, electric_provider, default_rate_per_kwh,
          unit (
            id, unit_number, type, floor, monthly_rent, status,
            lease (
              id, status,
              lease_tenant (role, tenant:tenant_id (id, name))
            )
          )
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as PropertyDetail;
    },
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      propertyId: string;
      unitNumber: string;
      type: UnitType;
      floor: string | null;
      monthlyRent: number;
    }) => {
      const { data, error } = await supabase
        .from('unit')
        .insert({
          property_id: params.propertyId,
          unit_number: params.unitNumber.trim(),
          type: params.type,
          floor: params.floor?.trim() || null,
          monthly_rent: params.monthlyRent,
          status: 'vacant',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (unitId, params) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', params.propertyId] });
      queryClient.invalidateQueries({ queryKey: ['unit', unitId] });
    },
  });
}

export type UnitDetail = {
  id: string;
  unit_number: string;
  type: string | null;
  floor: string | null;
  monthly_rent: number;
  status: string;
  property: { id: string; name: string } | null;
  lease: {
    id: string;
    status: string;
    monthly_rent: number;
    start_date: string;
    end_date: string;
    security_deposit: number;
    security_deposit_balance: number;
    is_rent_controlled: boolean;
    lease_tenant: {
      role: string;
      tenant: { id: string; name: string; phone: string; email: string | null } | null;
    }[];
  }[];
};

export function useUnit(unitId?: string) {
  return useQuery({
    queryKey: ['unit', unitId],
    enabled: !!unitId,
    queryFn: async (): Promise<UnitDetail> => {
      const { data, error } = await supabase
        .from('unit')
        .select(`
          id, unit_number, type, floor, monthly_rent, status,
          property:property_id (id, name),
          lease (
            id, status, monthly_rent, start_date, end_date,
            security_deposit, security_deposit_balance, is_rent_controlled,
            lease_tenant (role, tenant:tenant_id (id, name, phone, email))
          )
        `)
        .eq('id', unitId!)
        .single();
      if (error) throw error;
      return data as unknown as UnitDetail;
    },
  });
}
