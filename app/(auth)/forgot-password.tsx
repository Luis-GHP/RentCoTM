import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { authRedirectUrl } from '../../lib/auth-links';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSendReset() {
    setError('');
    setSuccess('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter the email connected to your RentCo account.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: authRedirectUrl('/reset-password'),
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess('Password reset link sent. Open the email on this device, then enter your new password.');
  }

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-3xl font-bold text-primary mb-2">Reset Password</Text>
      <Text className="text-base text-gray-500 mb-10">A secure reset link will be sent to your email.</Text>

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

      <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
      <TextInput
        className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity
        className="bg-primary rounded-xl py-4 items-center"
        onPress={handleSendReset}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text className="text-white font-semibold text-base">Send Reset Link</Text>
        }
      </TouchableOpacity>

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity className="mt-4 items-center">
          <Text className="text-gray-500 text-sm">
            Remembered it? <Text className="text-primary font-semibold">Sign in</Text>
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
