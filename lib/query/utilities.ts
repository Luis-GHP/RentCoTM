import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type UtilityFilter = 'all' | 'pending' | 'confirmed';

export type UtilityBillRow = {
  id: string;
  unit_id: string;
  period_month: number;
  period_year: number;
  utility_type: 'electric' | 'water' | 'internet' | 'other';
  provider: string;
  reading_start: number | null;
  reading_end: number | null;
  kwh_consumed: number | null;
  rate_per_kwh: number | null;
  amount: number;
  status: 'unpaid' | 'paid';
  bill_pdf_url: string | null;
  parsed_by: 'llm' | 'manual' | null;
  parse_confidence: 'high' | 'medium' | 'low' | null;
  uploaded_by: 'landlord' | 'tenant';
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  unit: { id: string; unit_number: string; property: { id: string; name: string } | null } | null;
};

export type UtilityUnitOption = {
  id: string;
  unit_number: string;
  property: { id: string; name: string } | null;
};

export type ParsedUtilityBill = {
  provider: string;
  utility_type: 'electric' | 'water' | 'internet' | 'other';
  period_month: number;
  period_year: number;
  reading_start: number | null;
  reading_end: number | null;
  kwh_consumed: number | null;
  rate_per_kwh: number | null;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeBill(row: any): UtilityBillRow {
  const unit = normalizeOne(row.unit);
  return {
    ...row,
    unit: unit ? { ...unit, property: normalizeOne(unit.property) } : null,
  } as UtilityBillRow;
}

async function uploadPdf(uri: string, fileName: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to upload utility bills.');

  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `landlord/${user.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
  const { error } = await supabase.storage.from('utility-bills').upload(path, blob, {
    contentType: blob.type || 'application/pdf',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('utility-bills').getPublicUrl(path).data.publicUrl;
}

export function useAllUtilityBills(filter: UtilityFilter = 'all') {
  return useQuery({
    queryKey: ['utility-bills', filter],
    queryFn: async (): Promise<UtilityBillRow[]> => {
      const { data, error } = await supabase
        .from('utility_bill')
        .select(`
          id, unit_id, period_month, period_year, utility_type, provider,
          reading_start, reading_end, kwh_consumed, rate_per_kwh, amount,
          status, bill_pdf_url, parsed_by, parse_confidence, uploaded_by,
          confirmed_by, confirmed_at, created_at,
          unit:unit_id (id, unit_number, property:property_id (id, name))
        `)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;

      return ((data ?? []) as any[]).map(normalizeBill).filter(bill => {
        if (filter === 'pending') return !bill.confirmed_at;
        if (filter === 'confirmed') return !!bill.confirmed_at;
        return true;
      });
    },
  });
}

export function useUtilityBill(id?: string) {
  return useQuery({
    queryKey: ['utility-bill', id],
    enabled: !!id,
    queryFn: async (): Promise<UtilityBillRow> => {
      const { data, error } = await supabase
        .from('utility_bill')
        .select(`
          id, unit_id, period_month, period_year, utility_type, provider,
          reading_start, reading_end, kwh_consumed, rate_per_kwh, amount,
          status, bill_pdf_url, parsed_by, parse_confidence, uploaded_by,
          confirmed_by, confirmed_at, created_at,
          unit:unit_id (id, unit_number, property:property_id (id, name))
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return normalizeBill(data);
    },
  });
}

export function useUtilityUnitOptions() {
  return useQuery({
    queryKey: ['utility-unit-options'],
    queryFn: async (): Promise<UtilityUnitOption[]> => {
      const { data, error } = await supabase
        .from('unit')
        .select('id, unit_number, property:property_id (id, name)')
        .order('unit_number', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map(unit => ({
        id: unit.id,
        unit_number: unit.unit_number,
        property: normalizeOne(unit.property),
      }));
    },
  });
}

export function useParseUtilityBill() {
  return useMutation({
    mutationFn: async (params: { uri: string; fileName: string }) => {
      const billPdfUrl = await uploadPdf(params.uri, params.fileName);
      const { data, error } = await supabase.functions.invoke('parse-utility-bill', {
        body: { bill_pdf_url: billPdfUrl },
      });

      if (error || data?.error) {
        return {
          billPdfUrl,
          unavailable: data?.error === 'anthropic_unavailable',
          message: data?.message ?? 'Could not parse this document. Please enter details manually.',
          parsed: null as ParsedUtilityBill | null,
        };
      }

      return {
        billPdfUrl,
        unavailable: false,
        message: null,
        parsed: data.data as ParsedUtilityBill,
      };
    },
  });
}

export function useCreateUtilityBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unitId: string;
      periodMonth: number;
      periodYear: number;
      utilityType: string;
      provider: string;
      readingStart: number | null;
      readingEnd: number | null;
      kwhConsumed: number | null;
      ratePerKwh: number | null;
      amount: number;
      billPdfUrl: string | null;
      parsedBy: 'llm' | 'manual';
      confidence: 'high' | 'medium' | 'low' | null;
    }) => {
      const { data, error } = await supabase
        .from('utility_bill')
        .insert({
          unit_id: params.unitId,
          period_month: params.periodMonth,
          period_year: params.periodYear,
          utility_type: params.utilityType,
          provider: params.provider,
          reading_start: params.readingStart,
          reading_end: params.readingEnd,
          kwh_consumed: params.kwhConsumed,
          rate_per_kwh: params.ratePerKwh,
          amount: params.amount,
          status: 'unpaid',
          bill_pdf_url: params.billPdfUrl,
          parsed_by: params.parsedBy,
          parse_confidence: params.confidence,
          rate_source: params.ratePerKwh == null ? null : params.parsedBy === 'llm' ? 'llm_parsed' : 'manual',
          uploaded_by: 'landlord',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
    },
  });
}

export function useConfirmUtilityBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('utility_bill')
        .update({
          confirmed_by: 'landlord',
          confirmed_at: new Date().toISOString(),
          confirmed_by_user: true,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', id] });
    },
  });
}

export function useUpdateUtilityBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      provider: string;
      utilityType: string;
      periodMonth: number;
      periodYear: number;
      kwhConsumed: number | null;
      ratePerKwh: number | null;
      amount: number;
    }) => {
      const { error } = await supabase
        .from('utility_bill')
        .update({
          provider: params.provider,
          utility_type: params.utilityType,
          period_month: params.periodMonth,
          period_year: params.periodYear,
          kwh_consumed: params.kwhConsumed,
          rate_per_kwh: params.ratePerKwh,
          amount: params.amount,
        })
        .eq('id', params.id)
        .is('confirmed_at', null);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', id] });
    },
  });
}
