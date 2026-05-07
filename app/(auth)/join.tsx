import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { notifyLandlordsForTenant } from '../../lib/notifications';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [isInviteValid, setIsInviteValid] = useState(false);
  const [propertyName, setPropertyName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');

  useEffect(() => {
    async function validateToken() {
      const { data, error } = await supabase.functions.invoke('validate-invite', {
        body: { token },
      });
      setValidating(false);
      const result = Array.isArray(data) ? data[0] : data;
      if (error || !result?.is_valid) {
        setError(result?.reason ?? 'This invite link is invalid or has expired.');
        return;
      }
      setIsInviteValid(true);
      setName(result.tenant_name ?? '');
      setPropertyName(result.property_name ?? '');
      setUnitNumber(result.unit_number ?? '');
    }

    if (!token) { setError('Invalid invite link.'); setValidating(false); return; }
    validateToken();
  }, [token]);

  async function handleSetup() {
    setError('');
    const displayName = name.trim();
    const normalizedPhone = phone.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!displayName) { setError('Your full name is required.'); return; }
    if (!normalizedPhone) { setError('Phone number is required.'); return; }
    if (!normalizedEmail) { setError('Email is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (!data.session) {
      setLoading(false);
      setError('Please check your email and confirm your account, then sign in.');
      return;
    }

    const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invite_token', {
      p_token: token,
      p_user_id: data.user!.id,
      p_name: displayName,
      p_phone: normalizedPhone,
      p_email: normalizedEmail,
    });
    if (acceptError) { setError(acceptError.message); setLoading(false); return; }

    const acceptedTenantId =
      Array.isArray(acceptData)
        ? acceptData[0]?.tenant_id
        : typeof acceptData === 'object' && acceptData && 'tenant_id' in acceptData
          ? (acceptData as { tenant_id?: string }).tenant_id
          : null;

    await refreshProfile();
    if (acceptedTenantId) {
      void notifyLandlordsForTenant(acceptedTenantId, {
        title: 'Invite accepted',
        body: `${displayName} joined RentCo.`,
        data: { type: 'invite_accepted', route: `/(landlord)/tenants/${acceptedTenantId}`, tenant_id: acceptedTenantId },
      });
    }
    router.replace('/');
  }

  if (validating) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2F4A7D" />
        <Text className="text-gray-500 mt-4">Validating invite...</Text>
      </View>
    );
  }

  if (!isInviteValid) {
    return (
      <View className="flex-1 bg-white px-6 justify-center items-center">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</Text>
        <Text className="text-gray-500 text-center mb-8">{error}</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text className="text-primary font-semibold">Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-3xl font-bold text-primary mb-2">Set Up Account</Text>
      <Text className="text-base text-gray-500 mb-8">Add your details to accept this lease invite.</Text>

      {propertyName || unitNumber ? (
        <View className="bg-confirmed-bg border border-confirmed rounded-xl p-4 mb-6">
          <Text className="text-primary font-semibold text-base">
            {propertyName || 'Your rental'}
          </Text>
          <Text className="text-gray-600 text-sm mt-1">
            {unitNumber ? `Unit ${unitNumber}` : 'Your landlord has invited you to join this lease.'}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}

      <Text className="text-sm font-medium text-gray-700 mb-1">Full Name</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
        placeholder="Juan dela Cruz"
        value={name}
        onChangeText={setName}
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">Phone Number</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
        placeholder="09XX XXX XXXX"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
        placeholder="Min. 8 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">Confirm Password</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
        placeholder="Re-enter password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity
        className="bg-primary rounded-xl py-4 items-center"
        onPress={handleSetup}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text className="text-white font-semibold text-base">Create Account</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}
