import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function validateToken() {
      const { data, error } = await supabase.rpc('validate_invite_token', { p_token: token });
      setValidating(false);
      if (error || !data?.[0]?.is_valid) {
        setError(data?.[0]?.reason ?? 'This invite link is invalid or has expired.');
        return;
      }
      setTenantId(data[0].tenant_id);
    }

    if (!token) { setError('Invalid invite link.'); setValidating(false); return; }
    validateToken();
  }, [token]);

  async function handleSetup() {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (!data.session) {
      setLoading(false);
      setError('Please check your email and confirm your account, then sign in.');
      return;
    }

    const { error: acceptError } = await supabase.rpc('accept_invite_token', {
      p_token: token,
      p_user_id: data.user!.id,
    });
    if (acceptError) { setError(acceptError.message); setLoading(false); return; }

    await refreshProfile();
    router.replace('/');
  }

  if (validating) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#1B3C34" />
        <Text className="text-gray-500 mt-4">Validating invite...</Text>
      </View>
    );
  }

  if (!tenantId) {
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
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-3xl font-bold text-primary mb-2">Set Up Account</Text>
      <Text className="text-base text-gray-500 mb-10">Create your tenant account to get started.</Text>

      {error ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}

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
    </View>
  );
}
