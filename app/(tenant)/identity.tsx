import { ActivityIndicator, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../lib/auth';
import { useTenant } from '../../lib/query/tenants';
import { useTenantIdentityVerification, useCreateDiditSession, useSyncDiditSession, identityStatusLabel, identityStatusTone, TenantIdentityVerification } from '../../lib/query/identity';
import { Button } from '../../components/shared/Button';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { PageBackground } from '../../components/shared/PageBackground';
import { PromptBanner } from '../../components/shared/PromptBanner';
import { formatDate } from '../../lib/format';

const PRIMARY = '#2F4A7D';

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 16px rgba(15, 23, 42, 0.08)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
});

function terminalButRetryable(status?: string | null) {
  return ['declined', 'expired', 'abandoned', 'kyc_expired', 'error'].includes(status ?? '');
}

function statusMessage(verification?: TenantIdentityVerification | null) {
  if (!verification) return 'No identity verification request right now. If your landlord requests one, it will appear in your notifications.';
  if (verification.status === 'not_started') return 'Your landlord requested identity verification. Review the consent note carefully before starting.';
  if (verification.status === 'approved') return 'Your identity was verified through Didit. Your landlord can see this verified status.';
  if (verification.status === 'in_review') return 'Didit is reviewing your verification. You can refresh this page after a few minutes.';
  if (verification.status === 'in_progress') return 'Your verification is in progress. Continue the secure Didit flow when you are ready.';
  if (verification.status === 'resubmitted') return 'Didit needs you to retry part of the verification. Continue the verification flow.';
  if (verification.status === 'declined') return 'The verification was declined. You can start a new verification when your landlord asks you to retry.';
  if (verification.status === 'expired') return 'The verification link expired. Start a new verification session.';
  if (verification.status === 'abandoned') return 'The verification was not completed. Start a new verification session when ready.';
  if (verification.status === 'error') return verification.last_error ?? 'Verification could not start. Please try again.';
  return 'Open the secure Didit flow and complete the identity check.';
}

function StatusPill({ verification }: { verification?: TenantIdentityVerification | null }) {
  const tone = identityStatusTone(verification?.status);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, backgroundColor: tone.bg, paddingHorizontal: 11, paddingVertical: 6 }}>
      <Ionicons name={tone.icon} size={14} color={tone.text} />
      <Text style={{ color: tone.text, fontSize: 12, fontWeight: '900', marginLeft: 5 }}>
        {identityStatusLabel(verification?.status)}
      </Text>
    </View>
  );
}

function StepRow({ done, label, description }: { done?: boolean; label: string; description: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: done ? '#EAF7EF' : '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
        <Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={15} color={done ? '#14804A' : '#9CA3AF'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#111827' }}>{label}</Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: '#6B7280', marginTop: 2 }}>{description}</Text>
      </View>
    </View>
  );
}

export default function TenantIdentityScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? undefined;
  const { data: tenant, isLoading: tenantLoading } = useTenant(tenantId);
  const { data: verification, isLoading: identityLoading } = useTenantIdentityVerification(tenantId);
  const createSession = useCreateDiditSession();
  const syncSession = useSyncDiditSession(tenantId);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  const isLoading = tenantLoading || identityLoading;
  const busy = createSession.isPending || syncSession.isPending;
  const approved = verification?.status === 'approved';
  const callbackUrl = Linking.createURL('/identity');
  const returnRoute = from === 'tenant-info' ? '/(tenant)/profile' : from === 'profile' ? '/(tenant)/more' : '/';
  const returnLabel = from === 'tenant-info' ? 'Go to Tenant Info' : from === 'profile' ? 'Go to Profile' : 'Go to Dashboard';

  function goBack() {
    router.replace(returnRoute as any);
  }

  async function openVerification(url: string) {
    if (Platform.OS === 'web') {
      window.location.assign(url);
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  }

  async function startVerification() {
    setError('');
    if (!verification) {
      setError('There is no identity verification request right now.');
      return;
    }
    if (!consent) {
      setError('Please confirm consent before starting identity verification.');
      return;
    }
    try {
      const session = await createSession.mutateAsync({ callbackUrl });
      if (session.verification_url) await openVerification(session.verification_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start identity verification.');
    }
  }

  async function refreshStatus() {
    setError('');
    try {
      await syncSession.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh verification.');
    }
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  const shouldShowVerificationAction = !!verification && !approved;
  const verificationActionLabel = verification
    ? terminalButRetryable(verification.status)
      ? 'Start New Verification'
      : verification.status === 'not_started'
        ? 'Start Verification'
        : 'Continue Verification'
    : '';

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PageBackground />
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: PRIMARY, paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: 58, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <View style={{ position: 'absolute', width: 340, height: 190, borderRadius: 170, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', top: 30, right: -142, transform: [{ rotate: '-12deg' }] }} />
            <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.035)', bottom: -86, left: -68 }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
            <TouchableOpacity onPress={goBack} activeOpacity={0.75} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Identity Verification</Text>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>Landlord-requested check</Text>
            </View>
          </View>

          <Text style={{ color: '#D7E3F6', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 }}>
            {tenant?.name ?? 'Tenant'}
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '900' }}>
            Complete verification only when requested.
          </Text>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: -32, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E0DC', padding: 16, ...CARD_SHADOW }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#111827' }}>Didit KYC</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: '#6B7280', marginTop: 3 }}>
                Didit checks your ID, liveness, and face match. RentCo stores the result, not your raw ID capture.
              </Text>
            </View>
            <StatusPill verification={verification} />
          </View>

          <PromptBanner
            tone={approved ? 'success' : terminalButRetryable(verification?.status) ? 'warning' : 'guidance'}
            solid={approved}
            message={statusMessage(verification)}
            style={{ marginBottom: 16 }}
          />

          {error ? <PromptBanner tone="error" message={error} style={{ marginBottom: 16 }} /> : null}

          {verification && !approved ? (
            <TouchableOpacity
              onPress={() => setConsent(current => !current)}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: consent ? '#D8E2F2' : '#E4E0DC', padding: 13, marginBottom: 14 }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: consent ? PRIMARY : '#FFFFFF', borderWidth: 1, borderColor: consent ? PRIMARY : '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 }}>
                {consent ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: '#374151', fontWeight: '600' }}>
                I consent to RentCo requesting identity verification through Didit, including ID document capture, liveness, and face matching where required by the workflow.
              </Text>
            </TouchableOpacity>
          ) : null}

          {shouldShowVerificationAction ? (
            <Button label={verificationActionLabel} loading={createSession.isPending} onPress={startVerification} style={{ marginBottom: 10 }} />
          ) : null}

          {verification?.id ? (
            <Button label="Refresh Status" variant="secondary" loading={syncSession.isPending} onPress={refreshStatus} style={{ marginBottom: approved ? 10 : 0 }} />
          ) : null}

          {approved ? (
            <Button label={returnLabel} onPress={goBack} />
          ) : null}

          {!verification ? (
            <Button label={returnLabel} onPress={goBack} />
          ) : null}
        </View>

        <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E0DC', padding: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 14 }}>What Happens</Text>
          <StepRow done={!!verification} label="Landlord requests verification" description="Your landlord asks for identity verification only when they need a formal check." />
          <StepRow done={['started', 'in_progress', 'in_review', 'approved'].includes(verification?.status ?? '')} label="Start secure session" description="RentCo creates a Didit hosted verification link for your account." />
          <StepRow done={['in_progress', 'in_review', 'approved'].includes(verification?.status ?? '')} label="Complete verification" description="Didit guides you through ID capture, liveness, and face matching." />
          <StepRow done={['in_review', 'approved'].includes(verification?.status ?? '')} label="Review result" description="RentCo receives a status update from Didit and shows it to your landlord." />
          <StepRow done={approved} label="Verified tenant profile" description="Your account is marked verified without RentCo storing raw ID photos." />
        </View>

        {verification ? (
          <View style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E0DC', padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#111827', marginBottom: 12 }}>Verification Details</Text>
            <DetailRow label="Status" value={identityStatusLabel(verification.status)} />
            <DetailRow label="Provider" value="Didit" />
            <DetailRow label="Started" value={verification.started_at ? formatDate(verification.started_at) : 'Not started'} />
            <DetailRow label="Completed" value={verification.completed_at ? formatDate(verification.completed_at) : 'Not completed'} />
            {verification.verified_name ? <DetailRow label="Verified Name" value={verification.verified_name} /> : null}
            {verification.document_type ? <DetailRow label="Document" value={verification.document_type} /> : null}
            {verification.document_number_last4 ? <DetailRow label="Document Ending" value={`.... ${verification.document_number_last4}`} /> : null}
          </View>
        ) : null}

        {busy ? (
          <View style={{ marginTop: 18, alignItems: 'center' }}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1EFEC' }}>
      <Text style={{ flex: 1, fontSize: 12, color: '#6B7280', fontWeight: '800' }}>{label}</Text>
      <Text style={{ flex: 1.2, textAlign: 'right', fontSize: 13, color: '#111827', fontWeight: '800' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
