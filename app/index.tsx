import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, profile, isLoading, refreshProfile } = useAuth();
  const [profileRetryStarted, setProfileRetryStarted] = useState(false);
  const [profileRetryFinished, setProfileRetryFinished] = useState(false);

  useEffect(() => {
    if (!session || profile) {
      setProfileRetryStarted(false);
      setProfileRetryFinished(false);
      return;
    }

    if (isLoading || profileRetryStarted) return;

    setProfileRetryStarted(true);
    const t = setTimeout(() => {
      void refreshProfile()
        .catch(error => console.warn('[auth] profile retry failed:', error))
        .finally(() => setProfileRetryFinished(true));
    }, 800);
    return () => clearTimeout(t);
  }, [isLoading, session, profile, profileRetryStarted, refreshProfile]);

  if (isLoading || (session && !profile && !profileRetryFinished)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2F4A7D" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return <Redirect href="/(auth)/login" />;
  if (!profile.is_active) return <Redirect href="/(auth)/deactivated" />;
  if (profile.role === 'landlord') return <Redirect href="/(landlord)" />;
  return <Redirect href="/(tenant)" />;
}
