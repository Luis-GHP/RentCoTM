import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File as ExpoFile } from 'expo-file-system';
import { supabase } from '../supabase';
import { notifyTenantsForUnit, notifyTenantsForUtilityBill } from '../notifications';
import { getMonthName } from '../format';
import { createStorageRef, resolveStorageUrl } from '../storage';

export type UtilityFilter = 'all' | 'pending' | 'confirmed' | 'unpaid' | 'paid';

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
  status: 'unpaid' | 'payment_submitted' | 'paid';
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
  property: { id: string; name: string; electric_provider: string | null; default_rate_per_kwh: number | null } | null;
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

type ParseUtilityBillResponse = {
  data?: ParsedUtilityBill;
  error?: string;
  message?: string;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function normalizeBill(row: any): Promise<UtilityBillRow> {
  const unit = normalizeOne(row.unit);
  return {
    ...row,
    bill_pdf_url: await resolveStorageUrl(row.bill_pdf_url) ?? row.bill_pdf_url,
    unit: unit ? { ...unit, property: normalizeOne(unit.property) } : null,
  } as UtilityBillRow;
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/\.{2,}/g, '.').replace(/^\.+/, 'file-');
}

async function loadFileArrayBuffer(uri: string) {
  try {
    const file = new ExpoFile(uri);
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > 0) return arrayBuffer;
  } catch {
    // Web blob/content URIs can still work through fetch, so fall through.
  }

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('The selected PDF is empty. Pick the original bill file and try again.');
  }
  return arrayBuffer;
}

async function uploadPdf(uri: string, fileName: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to upload utility bills.');

  const arrayBuffer = await loadFileArrayBuffer(uri);
  const path = `landlord/${user.id}/${Date.now()}-${safeFileName(fileName)}`;
  const { error } = await supabase.storage.from('utility-bills').upload(path, arrayBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw error;
  return {
    path,
    storageRef: createStorageRef('utility-bills', path),
  };
}

async function invokeParseUtilityBill(billPdfPath: string): Promise<ParseUtilityBillResponse> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('You must be signed in to parse utility bills.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/parse-utility-bill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bill_pdf_path: billPdfPath }),
  });

  const text = await response.text();
  let payload: ParseUtilityBillResponse = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: 'invalid_response', message: text || `Parser failed with HTTP ${response.status}.` };
  }

  if (!response.ok && !payload.message) {
    payload.message = `Parser failed with HTTP ${response.status}.`;
  }

  return payload;
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

      const bills = await Promise.all(((data ?? []) as any[]).map(normalizeBill));
      return bills.filter(bill => {
        if (filter === 'pending') return !bill.confirmed_at;
        if (filter === 'confirmed') return !!bill.confirmed_at;
        if (filter === 'unpaid') return bill.status === 'unpaid';
        if (filter === 'paid') return bill.status === 'paid';
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
        .select('id, unit_number, property:property_id (id, name, electric_provider, default_rate_per_kwh)')
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
      const billPdf = await uploadPdf(params.uri, params.fileName);
      const data = await invokeParseUtilityBill(billPdf.path);

      if (data?.error) {
        return {
          billPdfUrl: billPdf.storageRef,
          unavailable: ['anthropic_unavailable', 'anthropic_request_failed'].includes(data?.error),
          message: data?.message ?? 'Could not parse this document. Please enter details manually.',
          parsed: null as ParsedUtilityBill | null,
        };
      }

      return {
        billPdfUrl: billPdf.storageRef,
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
      billFileName?: string | null;
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
          confirmed_by: 'landlord',
          confirmed_at: new Date().toISOString(),
          confirmed_by_user: true,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (params.billPdfUrl) {
        const { error: documentError } = await supabase.from('document').insert({
          entity_type: 'utility_bill',
          entity_id: data.id,
          doc_type: 'utility_bill_pdf',
          file_url: params.billPdfUrl,
          file_name: params.billFileName ?? 'Utility bill.pdf',
          uploaded_by: 'landlord',
        });
        if (documentError) {
          console.warn('Could not index utility bill PDF in documents', documentError);
        }
      }

      void notifyTenantsForUnit(params.unitId, {
        title: 'Utility bill posted',
        body: `${getMonthName(params.periodMonth)} ${params.periodYear} ${params.utilityType} bill is ready.`,
        data: { type: 'utility_bill_posted', route: `/(tenant)/utilities/${data.id}`, utility_bill_id: data.id },
      });
      return data.id as string;
    },
    onSuccess: id => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['unit-utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['documents', 'utility_bill', id] });
      queryClient.invalidateQueries({ queryKey: ['document-center'] });
    },
  });
}

export function useConfirmUtilityBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await withTimeout(
        supabase.rpc('confirm_utility_bill', {
          p_bill_id: id,
        }),
        15000,
        'Confirming this bill took too long. Check your connection and try again.'
      );
      if (error) throw error;
      void notifyTenantsForUtilityBill(id, {
        title: 'Utility bill confirmed',
        body: 'A utility bill has been reviewed and confirmed.',
        data: { type: 'utility_bill_confirmed', route: `/(tenant)/utilities/${id}`, utility_bill_id: id },
      });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['unit-utility-bills'] });
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
      queryClient.invalidateQueries({ queryKey: ['unit-utility-bills'] });
    },
  });
}

export function useMarkUtilityBillPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await withTimeout(
        supabase.rpc('set_utility_bill_payment_status', {
          p_bill_id: id,
          p_status: 'paid',
        }),
        15000,
        'Marking this bill paid took too long. Check your connection and try again.'
      );
      if (error) throw error;

      void notifyTenantsForUtilityBill(id, {
        title: 'Utility bill marked paid',
        body: 'Your utility bill payment has been marked paid.',
        data: { type: 'utility_bill_paid', route: `/(tenant)/utilities/${id}`, utility_bill_id: id },
      });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-utility-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-bills'] });
      queryClient.invalidateQueries({ queryKey: ['all-tenant-bills'] });
      queryClient.invalidateQueries({ queryKey: ['unit-utility-bills'] });
    },
  });
}

export function useMarkUtilityBillUnpaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await withTimeout(
        supabase.rpc('set_utility_bill_payment_status', {
          p_bill_id: id,
          p_status: 'unpaid',
        }),
        15000,
        'Marking this bill unpaid took too long. Check your connection and try again.'
      );
      if (error) throw error;

      void notifyTenantsForUtilityBill(id, {
        title: 'Utility bill marked unpaid',
        body: 'Your utility bill still needs payment review.',
        data: { type: 'utility_bill_unpaid', route: `/(tenant)/utilities/${id}`, utility_bill_id: id },
      });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['utility-bills'] });
      queryClient.invalidateQueries({ queryKey: ['utility-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-utility-bill', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-bills'] });
      queryClient.invalidateQueries({ queryKey: ['all-tenant-bills'] });
      queryClient.invalidateQueries({ queryKey: ['unit-utility-bills'] });
    },
  });
}
