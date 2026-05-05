import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, profile, isLoading, refreshProfile } = useAuth();

  useEffect(() => {
    // Session exists but profile fetch returned null — retry once after a short delay.
    // This covers the race between onAuthStateChange firing and the profile row being ready.
    if (!isLoading && session && !profile) {
      const t = setTimeout(refreshProfile, 800);
      return () => clearTimeout(t);
    }
  }, [isLoading, session, profile, refreshProfile]);

  if (isLoading || (session && !profile)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1B3C34" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return null;
  if (!profile.is_active) return <Redirect href="/(auth)/deactivated" />;
  if (profile.role === 'landlord') return <Redirect href="/(landlord)" />;
  return <Redirect href="/(tenant)" />;
}
