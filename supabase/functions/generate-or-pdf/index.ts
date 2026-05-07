import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPHP(amount: number) {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentication required' }, 401);

    const { payment_id } = await req.json();
    if (!payment_id) return json({ error: 'payment_id is required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401);

    const { data: profile, error: profileError } = await serviceClient
      .from('user_profile')
      .select('role, landlord_id')
      .eq('id', authData.user.id)
      .single();
    if (profileError) return json({ error: profileError.message }, 500);
    if (profile?.role !== 'landlord' || !profile.landlord_id) return json({ error: 'Landlord role required' }, 403);

    const { data: landlord, error: landlordError } = await serviceClient
      .from('landlord')
      .select('name')
      .eq('id', profile.landlord_id)
      .single();
    if (landlordError) return json({ error: landlordError.message }, 500);

    const { data: payment, error: paymentError } = await serviceClient
      .from('rent_payment')
      .select(`
        id, period_month, period_year, amount_paid, payment_method,
        reference_number, or_number, confirmed_at, payment_date,
        lease:lease_id (
          unit:unit_id (unit_number, property:property_id (name, landlord_id)),
          lease_tenant (role, tenant:tenant_id (name))
        )
      `)
      .eq('id', payment_id)
      .single();
    if (paymentError) return json({ error: paymentError.message }, 500);

    const lease = Array.isArray(payment.lease) ? payment.lease[0] : payment.lease;
    const unit = Array.isArray(lease?.unit) ? lease.unit[0] : lease?.unit;
    const property = Array.isArray(unit?.property) ? unit.property[0] : unit?.property;
    if (property?.landlord_id !== profile.landlord_id) return json({ error: 'Payment not found for landlord' }, 404);
    if (!payment.or_number) return json({ error: 'Payment has no OR number yet' }, 400);

    const tenants = Array.isArray(lease?.lease_tenant) ? lease.lease_tenant : [];
    const primary = tenants.find((lt: any) => lt.role === 'primary') ?? tenants[0];
    const tenant = Array.isArray(primary?.tenant) ? primary.tenant[0] : primary?.tenant;

    const or_number = payment.or_number;
    const tenant_name = tenant?.name ?? 'Tenant';
    const unit_number = unit?.unit_number ?? '-';
    const property_name = property?.name ?? '';
    const period_month = payment.period_month;
    const period_year = payment.period_year;
    const amount_paid = Number(payment.amount_paid);
    const payment_method = payment.payment_method ?? 'cash';
    const reference_number = payment.reference_number;
    const landlord_name = landlord.name;
    const issued_date = payment.confirmed_at ?? payment.payment_date ?? new Date().toISOString();

    // ── Build PDF ────────────────────────────────────────────────
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold   = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontNormal = await doc.embedFont(StandardFonts.Helvetica);

    const brand  = rgb(0.184, 0.290, 0.490); // #2F4A7D
    const dark   = rgb(0.067, 0.094, 0.110); // #111827
    const gray   = rgb(0.420, 0.447, 0.439); // #6B7280
    const white  = rgb(1, 1, 1);
    const border = rgb(0.894, 0.878, 0.863); // #E4E0DC

    // Header background
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: brand });

    // App name
    page.drawText('RentCo', {
      x: 40, y: height - 45,
      size: 24, font: fontBold, color: white,
    });

    // Official Receipt title
    page.drawText('OFFICIAL RECEIPT', {
      x: 40, y: height - 70,
      size: 11, font: fontNormal, color: rgb(0.780, 0.906, 0.847),
    });

    // OR number (top right)
    page.drawText(or_number, {
      x: width - 40 - fontBold.widthOfTextAtSize(or_number, 13),
      y: height - 50,
      size: 13, font: fontBold, color: white,
    });
    page.drawText('OR Number', {
      x: width - 40 - fontNormal.widthOfTextAtSize('OR Number', 9),
      y: height - 68,
      size: 9, font: fontNormal, color: rgb(0.780, 0.906, 0.847),
    });

    // ── Body ─────────────────────────────────────────────────────
    let y = height - 140;

    // Issued date
    page.drawText('Date Issued', { x: 40, y, size: 9, font: fontNormal, color: gray });
    page.drawText(formatDate(issued_date), { x: 200, y, size: 10, font: fontNormal, color: dark });
    y -= 28;

    // Divider
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: border });
    y -= 20;

    // Tenant
    page.drawText('Received From', { x: 40, y, size: 9, font: fontNormal, color: gray });
    page.drawText(tenant_name, { x: 200, y, size: 10, font: fontBold, color: dark });
    y -= 22;

    // Unit / Property
    page.drawText('Unit', { x: 40, y, size: 9, font: fontNormal, color: gray });
    page.drawText(`${unit_number} — ${property_name}`, { x: 200, y, size: 10, font: fontNormal, color: dark });
    y -= 22;

    // Period
    page.drawText('For Period', { x: 40, y, size: 9, font: fontNormal, color: gray });
    page.drawText(`${MONTHS[period_month - 1]} ${period_year} Rent`, { x: 200, y, size: 10, font: fontNormal, color: dark });
    y -= 28;

    // Divider
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: border });
    y -= 20;

    // Payment method
    const methodLabel: Record<string, string> = {
      gcash: 'GCash', maya: 'Maya', bank: 'Bank Transfer', cash: 'Cash', advance: 'Advance',
    };
    page.drawText('Payment Method', { x: 40, y, size: 9, font: fontNormal, color: gray });
    page.drawText(methodLabel[payment_method] ?? payment_method, { x: 200, y, size: 10, font: fontNormal, color: dark });
    y -= 22;

    // Reference number
    if (reference_number) {
      page.drawText('Reference No.', { x: 40, y, size: 9, font: fontNormal, color: gray });
      page.drawText(reference_number, { x: 200, y, size: 10, font: fontNormal, color: dark });
      y -= 22;
    }

    y -= 16;

    // Amount box
    page.drawRectangle({ x: 40, y: y - 24, width: width - 80, height: 56, color: rgb(0.910, 0.961, 0.941) });
    page.drawText('AMOUNT PAID', { x: 56, y: y + 12, size: 9, font: fontBold, color: green });
    const amtStr = formatPHP(amount_paid);
    page.drawText(amtStr, {
      x: width - 40 - fontBold.widthOfTextAtSize(amtStr, 22) - 16,
      y: y - 14,
      size: 22, font: fontBold, color: green,
    });

    y -= 70;

    // Landlord signature line
    page.drawLine({ start: { x: 40, y }, end: { x: 200, y }, thickness: 1, color: border });
    y -= 14;
    page.drawText(landlord_name, { x: 40, y, size: 10, font: fontBold, color: dark });
    y -= 14;
    page.drawText('Landlord / Authorized Signatory', { x: 40, y, size: 9, font: fontNormal, color: gray });

    // Footer
    page.drawText('This is a system-generated receipt from RentCo.', {
      x: 40, y: 40, size: 8, font: fontNormal, color: gray,
    });

    // ── Upload to Supabase Storage ────────────────────────────────
    const pdfBytes = await doc.save();

    const fileName = `${profile.landlord_id}/${or_number}.pdf`;
    const { error: uploadError } = await serviceClient.storage
      .from('or-pdfs')
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) return json({ error: uploadError.message }, 500);

    const storageRef = `storage://or-pdfs/${fileName}`;
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from('or-pdfs')
      .createSignedUrl(fileName, 15 * 60);
    if (signedUrlError) return json({ error: signedUrlError.message }, 500);

    const { data: existingDoc } = await serviceClient
      .from('document')
      .select('id')
      .eq('entity_type', 'rent_payment')
      .eq('entity_id', payment.id)
      .eq('doc_type', 'or_pdf')
      .maybeSingle();

    if (!existingDoc) {
      await serviceClient.from('document').insert({
        entity_type: 'rent_payment',
        entity_id: payment.id,
        doc_type: 'or_pdf',
        file_url: storageRef,
        file_name: `${or_number}.pdf`,
        uploaded_by: 'landlord',
      });
    }

    return json({ url: signedUrlData.signedUrl, or_number });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
