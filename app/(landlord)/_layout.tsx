import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';

export default function LandlordLayout() {
  const { profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!profile || profile.role !== 'landlord' || !profile.is_active) {
      router.replace('/(auth)/login');
    }
  }, [profile, isLoading]);

  if (isLoading || !profile) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1B3C34',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="properties/add"                options={{ href: null }} />
      <Tabs.Screen name="properties/[id]"               options={{ href: null }} />
      <Tabs.Screen name="properties/[id]/units/[unitId]" options={{ href: null }} />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="payments/record" options={{ href: null }} />
      <Tabs.Screen name="payments/[id]"   options={{ href: null }} />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Maintenance',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="maintenance/[id]"  options={{ href: null }} />
      <Tabs.Screen name="tenants"           options={{ href: null }} />
      <Tabs.Screen name="tenants/[id]"      options={{ href: null }} />
      <Tabs.Screen name="tenants/invite"    options={{ href: null }} />
      <Tabs.Screen name="utilities"         options={{ href: null }} />
      <Tabs.Screen name="utilities/[id]"    options={{ href: null }} />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
