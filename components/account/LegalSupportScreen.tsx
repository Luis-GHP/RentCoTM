import { ComponentProps, ReactNode, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppModal, Button, Card, LoadingSpinner, PageBackground, PromptBanner } from '../shared';
import { useAuth } from '../../lib/auth';
import {
  accountDeletionStatusLabel,
  friendlyDeletionRequestError,
  isOpenAccountDeletionRequest,
  useOwnAccountDeletionRequest,
  useRequestAccountDeletion,
} from '../../lib/query/legal';
import { formatDate } from '../../lib/format';

const PRIMARY = '#2F4A7D';
const SUPPORT_EMAIL = 'support@rentco.app';
const PRIVACY_EMAIL = 'privacy@rentco.app';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  returnRoute: string;
  audience: 'landlord' | 'tenant';
};

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 18px rgba(15, 23, 42, 0.08)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
});

function HeaderTexture() {
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[0, 1, 2, 3].map(index => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: 12 + index * 23,
            right: -235 + index * 34,
            width: 450,
            height: 255,
            borderRadius: 225,
            borderWidth: 1,
            borderColor: `rgba(255,255,255,${0.082 - index * 0.014})`,
            transform: [{ rotate: '-14deg' }],
          }}
        />
      ))}
      <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.035)', right: -82, bottom: -92 }} />
    </View>
  );
}

function PolicyCard({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
          <Ionicons name={icon} size={19} color={PRIMARY} />
        </View>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '900', color: '#111827' }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function BodyText({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: 13, lineHeight: 20, color: '#4B5563', fontWeight: '500' }}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 9 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D7E3F6', marginTop: 7, marginRight: 9 }} />
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: '#4B5563', fontWeight: '500' }}>
        {children}
      </Text>
    </View>
  );
}

function ContactButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.76}
      style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', padding: 13, marginTop: 10 }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
        <Ionicons name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#111827' }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="open-outline" size={17} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function statusTone(status?: string | null) {
  if (status === 'completed') return { bg: '#EAF7EF', text: '#14804A', icon: 'checkmark-circle-outline' as const };
  if (status === 'requested' || status === 'in_review') return { bg: '#FFFBEB', text: '#B45309', icon: 'time-outline' as const };
  if (status === 'rejected') return { bg: '#FEF2F2', text: '#B91C1C', icon: 'alert-circle-outline' as const };
  return { bg: '#F1EFEC', text: '#6B7280', icon: 'shield-checkmark-outline' as const };
}

export function LegalSupportScreen({ returnRoute, audience }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const deletionQuery = useOwnAccountDeletionRequest();
  const requestDeletion = useRequestAccountDeletion();
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [supportError, setSupportError] = useState('');

  const request = deletionQuery.data;
  const openRequest = isOpenAccountDeletionRequest(request?.status);
  const currentRole = profile?.role ?? audience;
  const displayRole = currentRole === 'landlord' ? 'landlord' : 'tenant';
  const status = statusTone(request?.status);

  const deletionMessage = useMemo(() => {
    if (!request) {
      return 'You can initiate account and personal-data deletion from inside RentCo. This starts a review, because some lease, payment, receipt, tax, security, fraud-prevention, or dispute records may need to be retained where legally required or legitimately necessary.';
    }
    if (openRequest) {
      return 'Your request is in review. RentCo will review account records tied to leases, payments, receipts, documents, security, and support before completing deletion or explaining any records that must be retained.';
    }
    return 'Your latest deletion request is no longer open. You can submit a new request if you still need help with account or data deletion.';
  }, [openRequest, request]);

  function goBack() {
    router.replace(returnRoute as any);
  }

  async function openEmail(email: string, subject: string) {
    setSupportError('');
    const body = `Hello RentCo,\n\nI am a ${displayRole}. Please help me with:\n\n`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('Mail app unavailable');
      await Linking.openURL(url);
    } catch {
      setSupportError('Could not open your mail app. Email RentCo directly at support@rentco.app or privacy@rentco.app.');
    }
  }

  async function submitDeletionRequest() {
    setFormError('');
    try {
      await requestDeletion.mutateAsync(reason);
      setConfirmOpen(false);
      setSuccessOpen(true);
      setReason('');
    } catch (error) {
      setConfirmOpen(false);
      setFormError(friendlyDeletionRequestError(error));
    }
  }

  if (deletionQuery.isLoading) return <LoadingSpinner fullScreen />;

  const deletionQueryError = deletionQuery.error
    ? friendlyDeletionRequestError(deletionQuery.error)
    : '';

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <PageBackground />
      <ScrollView contentContainerStyle={{ paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: PRIMARY, paddingTop: insets.top + 18, paddingHorizontal: 20, paddingBottom: 54, overflow: 'hidden' }}>
          <HeaderTexture />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 26 }}>
            <TouchableOpacity
              onPress={goBack}
              activeOpacity={0.75}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>Legal & Support</Text>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>Terms, privacy, and account help</Text>
            </View>
          </View>

          <Text style={{ color: '#D7E3F6', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>
            RentCo policies
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '900' }}>
            Clear rules for your account and data.
          </Text>
        </View>

        <View style={{ marginHorizontal: 16, marginTop: -28 }}>
          <Card style={{ marginBottom: 14, ...CARD_SHADOW }}>
            <PromptBanner
              tone="guidance"
              solid
              icon="shield-checkmark-outline"
              message="Draft legal summary for review. Final terms, privacy policy, public deletion page, retention periods, and store disclosures should be approved by counsel before launch."
              style={{ marginBottom: 0 }}
            />
          </Card>

          <PolicyCard icon="document-text-outline" title="Terms & Conditions">
            <BodyText>
              RentCo is a rental-management tool for property, unit, lease, rent, utility bill, receipt, document, maintenance, notification, and landlord-tenant coordination workflows.
            </BodyText>
            <Bullet>Users should provide accurate account, contact, lease, payment, utility, and maintenance information.</Bullet>
            <Bullet>Users should upload only lawful, relevant files they are authorized to share, such as receipts, bills, photos, lease files, and maintenance attachments.</Bullet>
            <Bullet>RentCo is not a bank, escrow service, payment processor, tax adviser, legal adviser, property broker, insurer, government agency, or dispute-resolution authority.</Bullet>
            <Bullet>Landlords and tenants remain responsible for complying with leases, rental laws, tax and receipt obligations, and any agreements between them.</Bullet>
          </PolicyCard>

          <PolicyCard icon="lock-closed-outline" title="Privacy Policy">
            <BodyText>
              RentCo collects and uses information needed to operate the app, secure accounts, provide rental workflows, send notifications, support users, and comply with legal obligations.
            </BodyText>
            <Bullet>Account and profile data, including name, email, phone, role, landlord profile, tenant profile, and push token.</Bullet>
            <Bullet>Lease, property, unit, rent payment, receipt, utility bill, document, and maintenance request records.</Bullet>
            <Bullet>Uploaded files, including utility bills, payment receipts, maintenance photos, and shared documents.</Bullet>
            <Bullet>Landlord-requested identity verification status and limited provider metadata from Didit. RentCo is intended to store verification results, not raw ID-document captures from Didit.</Bullet>
            <Bullet>RentCo does not sell personal data. Data may be shared with users connected to the rental relationship, service providers needed to run the product, advisers, authorities, or others where required or permitted by law.</Bullet>
          </PolicyCard>

          <PolicyCard icon="server-outline" title="Data Retention & Deletion">
            <BodyText>
              You can request deletion of your account and related personal data from this page. Deletion requests are reviewed because rental records may involve legal, accounting, tax, security, support, and dispute obligations.
            </BodyText>
            <Bullet>RentCo should delete or anonymize data that is no longer needed and not legally or operationally required to retain.</Bullet>
            <Bullet>Some records may be retained, restricted, anonymized, or preserved when needed for legal compliance, fraud prevention, security, taxes, leases, receipts, disputes, or audit history.</Bullet>
            <Bullet>Before production submission, RentCo also needs a public privacy policy URL and public account deletion URL that match the in-app flow.</Bullet>
          </PolicyCard>

          <PolicyCard icon="finger-print-outline" title="Identity Verification Notice">
            <BodyText>
              Identity verification is not required for every tenant by default. A landlord may request it for a tenant profile, and Didit hosts the secure verification session when the tenant chooses to start.
            </BodyText>
            <Bullet>The verification flow may include ID document capture, liveness, and face matching based on the configured Didit workflow.</Bullet>
            <Bullet>RentCo receives verification status and limited metadata intended for landlord review.</Bullet>
            <Bullet>Verification does not guarantee tenant suitability, payment ability, lawful occupancy, or absence of fraud.</Bullet>
          </PolicyCard>

          <PolicyCard icon="git-network-outline" title="Third-Party Services">
            <BodyText>
              RentCo uses service providers to deliver core features. The final public privacy policy and app-store disclosures should match the providers actually used in production.
            </BodyText>
            <Bullet>Supabase for authentication, database, storage, edge functions, and signed file access.</Bullet>
            <Bullet>Didit for landlord-requested tenant identity verification.</Bullet>
            <Bullet>Expo for push notification delivery and app runtime services.</Bullet>
            <Bullet>Anthropic for AI-assisted utility bill parsing when a bill is uploaded for analysis.</Bullet>
            <Bullet>Apple App Store and Google Play services for app distribution, platform security, and store compliance.</Bullet>
          </PolicyCard>

          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: status.bg, alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                <Ionicons name={status.icon} size={19} color={status.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>Account Deletion Request</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{accountDeletionStatusLabel(request?.status)}</Text>
              </View>
            </View>

            <BodyText>{deletionMessage}</BodyText>

            {request ? (
              <View style={{ borderRadius: 16, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E4E0DC', padding: 12, marginTop: 13 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 12, color: '#6B7280', fontWeight: '800' }}>Latest request</Text>
                  <Text style={{ fontSize: 12, color: status.text, fontWeight: '900' }}>{accountDeletionStatusLabel(request.status)}</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#111827', fontWeight: '800', marginTop: 6 }}>
                  Requested {formatDate(request.requested_at)}
                </Text>
              </View>
            ) : null}

            {deletionQueryError ? (
              <PromptBanner tone="error" message={deletionQueryError} style={{ marginTop: 13, marginBottom: 0 }} />
            ) : null}

            {formError ? (
              <PromptBanner tone="error" message={formError} style={{ marginTop: 13, marginBottom: 0 }} />
            ) : null}

            {!openRequest ? (
              <>
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#374151', marginTop: 16, marginBottom: 7 }}>
                  Optional reason
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Tell us what you want deleted or reviewed..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  textAlignVertical="top"
                  style={{
                    minHeight: 92,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#E4E0DC',
                    backgroundColor: '#FFFFFF',
                    paddingHorizontal: 13,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: '#111827',
                    lineHeight: 20,
                    marginBottom: 12,
                  }}
                />
                <Button
                  label="Request Account Deletion"
                  variant="danger"
                  onPress={() => setConfirmOpen(true)}
                  disabled={!!deletionQueryError}
                />
              </>
            ) : null}
          </Card>

          <PolicyCard icon="help-buoy-outline" title="Support & Privacy Rights">
            <BodyText>
              Depending on applicable law, you may request access, correction, deletion, restriction, objection, withdrawal of consent, or information about how your data is processed. You can also contact RentCo for app support or security concerns.
            </BodyText>
            <ContactButton
              icon="mail-outline"
              title="Email Support"
              subtitle={SUPPORT_EMAIL}
              onPress={() => openEmail(SUPPORT_EMAIL, 'RentCo support request')}
            />
            <ContactButton
              icon="shield-outline"
              title="Email Privacy"
              subtitle={PRIVACY_EMAIL}
              onPress={() => openEmail(PRIVACY_EMAIL, 'RentCo privacy request')}
            />
            {supportError ? <PromptBanner tone="error" message={supportError} style={{ marginTop: 12, marginBottom: 0 }} /> : null}
          </PolicyCard>
        </View>
      </ScrollView>

      <AppModal
        visible={confirmOpen}
        tone="warning"
        icon="trash-outline"
        title="Request Account Deletion?"
        message="This starts a deletion request review. It does not instantly erase lease, payment, receipt, tax, security, or dispute records that RentCo may need to retain where required or legitimately necessary."
        confirmLabel="Submit Request"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={requestDeletion.isPending}
        onConfirm={submitDeletionRequest}
        onCancel={() => setConfirmOpen(false)}
      />

      <AppModal
        visible={successOpen}
        tone="success"
        title="Request Submitted"
        message="Your account deletion request has been recorded. RentCo will review your account records and follow up through support or privacy contact channels."
        confirmLabel="Done"
        onConfirm={() => setSuccessOpen(false)}
      />
    </SafeAreaView>
  );
}
