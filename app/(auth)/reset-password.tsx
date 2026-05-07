import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function parseRecoveryUrl(url: string | null) {
  const parsed: Record<string, string> = {};
  if (!url) return parsed;

  for (const separator of ['?', '#']) {
    const index = url.indexOf(separator);
    if (index === -1) continue;
    const part = url.slice(index + 1).split(separator === '?' ? '#' : '?')[0];
    const params = new URLSearchParams(part);
    params.forEach((value, key) => {
      parsed[key] = value;
    });
  }

  return parsed;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const currentUrl = Linking.useURL();
  const urlParams = useMemo(() => parseRecoveryUrl(currentUrl), [currentUrl]);
  const prepared = useRef(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preparing, setPreparing] = useState(true);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const accessToken = readParam(params.access_token) ?? urlParams.access_token ?? null;
  const refreshToken = readParam(params.refresh_token) ?? urlParams.refresh_token ?? null;
  const tokenHash = readParam(params.token_hash) ?? urlParams.token_hash ?? null;

  useEffect(() => {
    async function prepareRecoverySession() {
      const hasRecoveryPayload = (accessToken && refreshToken) || tokenHash;
      if (prepared.current && hasRecoveryPayload) return;
      setPreparing(true);
      setError('');

      try {
        if (!hasRecoveryPayload) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setReady(true);
            prepared.current = true;
            return;
          }

          setError('Open the reset link from your email on this device.');
          return;
        }

        prepared.current = true;

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          setReady(true);
          return;
        }

        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) throw verifyError;
          setReady(true);
          return;
        }
      } catch {
        setError('This reset link is invalid or expired. Request a new password reset link.');
      } finally {
        setPreparing(false);
      }
    }

    prepareRecoverySession();
  }, [accessToken, refreshToken, tokenHash]);

  async function handleUpdatePassword() {
    setError('');
    setSuccess('');
    if (!ready) {
      setError('Open a valid reset link before setting a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess('Password updated. You can sign in with the new password now.');
  }

  async function goToLogin() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-3xl font-bold text-primary mb-2">Set New Password</Text>
      <Text className="text-base text-gray-500 mb-10">Choose a new password for your RentCo account.</Text>

      {preparing ? (
        <View className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 flex-row items-center">
          <ActivityIndicator color="#2F4A7D" />
          <Text className="text-gray-600 text-sm ml-3">Checking reset link...</Text>
        </View>
      ) : null}

      {error ? (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}

      {success ? (
        <View className="bg-confirmed-bg border border-confirmed rounded-lg p-3 mb-4">
          <Text className="text-confirmed text-sm">{success}</Text>
        </View>
      ) : null}

      <Text className="text-sm font-medium text-gray-700 mb-1">New Password</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
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
        onPress={success ? goToLogin : handleUpdatePassword}
        disabled={loading || preparing}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text className="text-white font-semibold text-base">{success ? 'Back to Sign In' : 'Update Password'}</Text>
        }
      </TouchableOpacity>

      {!success ? (
        <TouchableOpacity className="mt-4 items-center" onPress={() => router.replace('/(auth)/forgot-password')}>
          <Text className="text-gray-500 text-sm">
            Need a new link? <Text className="text-primary font-semibold">Send another</Text>
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
