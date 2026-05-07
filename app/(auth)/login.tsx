import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { PromptBanner } from '../../components/shared/PromptBanner';

const PRIMARY = '#2F4A7D';
const MINT = '#FFB14A';
const SIGN_IN_BUTTON_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 18px rgba(3, 29, 23, 0.22)' },
  default: {
    shadowColor: '#14213F',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});

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

function AuthTexture() {
  const lineColor = 'rgba(255,255,255,0.075)';
  const softLine = 'rgba(167,227,197,0.12)';
  const gridLines = [
    { left: 0, top: 0, width: 74, height: 1 },
    { left: 0, top: 22, width: 116, height: 1 },
    { left: 0, top: 44, width: 88, height: 1 },
    { left: 0, top: 66, width: 52, height: 1 },
    { left: 0, top: 0, width: 1, height: 66 },
    { left: 30, top: 0, width: 1, height: 88 },
    { left: 60, top: 22, width: 1, height: 66 },
    { left: 90, top: 0, width: 1, height: 44 },
  ];

  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <View style={{ position: 'absolute', top: -120, right: -90, width: 330, height: 330, borderRadius: 165, backgroundColor: 'rgba(255,255,255,0.035)' }} />
      <View style={{ position: 'absolute', bottom: -160, left: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(255,255,255,0.032)' }} />
      <View style={{ position: 'absolute', top: 78, left: -54, width: 560, height: 340, borderRadius: 280, borderWidth: 1, borderColor: lineColor, transform: [{ rotate: '-13deg' }] }} />
      <View style={{ position: 'absolute', top: 110, left: -88, width: 620, height: 386, borderRadius: 310, borderWidth: 1, borderColor: 'rgba(255,255,255,0.052)', transform: [{ rotate: '-13deg' }] }} />
      <View style={{ position: 'absolute', top: 154, left: -132, width: 700, height: 440, borderRadius: 350, borderWidth: 1, borderColor: 'rgba(255,255,255,0.038)', transform: [{ rotate: '-13deg' }] }} />
      <View style={{ position: 'absolute', bottom: 176, right: -70, width: 280, height: 174, borderRadius: 140, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '16deg' }] }} />
      <View style={{ position: 'absolute', top: 188, right: 22, width: 116, height: 92, opacity: 0.72 }}>
        {gridLines.map((line, index) => (
          <View key={`auth-grid-top-${index}`} style={{ position: 'absolute', backgroundColor: softLine, ...line }} />
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: 98, left: 24, width: 116, height: 92, opacity: 0.4 }}>
        {gridLines.map((line, index) => (
          <View key={`auth-grid-bottom-${index}`} style={{ position: 'absolute', backgroundColor: softLine, ...line }} />
        ))}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const logoWidth = Math.min(Math.max(width - 96, 210), 300);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        15000,
        'Sign in took too long. Check your connection and try again.'
      );
      if (error) throw error;
      await refreshProfile();
      router.replace('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: PRIMARY }}>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <AuthTexture />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 46,
          }}
        >
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <Image
              source={require('../../assets/images/rentco-auth-logo.png')}
              resizeMode="contain"
              style={{ width: logoWidth, height: logoWidth * 0.218, marginBottom: 34 }}
            />

            <Text style={{ color: '#FFFFFF', fontSize: 36, lineHeight: 42, fontWeight: '900', marginBottom: 8 }}>
              Welcome back
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.76)', fontSize: 15, lineHeight: 22, marginBottom: 28 }}>
              Sign in to manage homes, payments, requests, and tenant updates.
            </Text>

            {error ? (
              <PromptBanner
                tone="error"
                message={error}
                style={{ marginBottom: 18, backgroundColor: 'rgba(254,242,242,0.96)' }}
              />
            ) : null}

            <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              Email
            </Text>
            <TextInput
              style={{
                height: 54,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.96)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.36)',
                paddingHorizontal: 16,
                color: '#1E3158',
                fontSize: 15,
                marginBottom: 16,
              }}
              placeholder="your@email.com"
              placeholderTextColor="#8FA8D1"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              selectionColor={PRIMARY}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700' }}>
                Password
              </Text>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity disabled={loading} activeOpacity={0.75}>
                  <Text style={{ color: MINT, fontSize: 13, fontWeight: '800' }}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <TextInput
              style={{
                height: 54,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.96)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.36)',
                paddingHorizontal: 16,
                color: '#1E3158',
                fontSize: 15,
                marginBottom: 22,
              }}
              placeholder="Password"
              placeholderTextColor="#8FA8D1"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              selectionColor={PRIMARY}
            />

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.82}
              style={{
                height: 56,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: loading ? 'rgba(255,255,255,0.68)' : '#FFFFFF',
                ...SIGN_IN_BUTTON_SHADOW,
              }}
            >
              {loading ? (
                <ActivityIndicator color={PRIMARY} />
              ) : (
                <Text style={{ color: PRIMARY, fontSize: 16, fontWeight: '900' }}>Sign In</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity disabled={loading} activeOpacity={0.75} style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>
                  New landlord? <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Create account</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
