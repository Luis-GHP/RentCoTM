import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import {
  canUseNativePushNotifications,
  notificationRoute,
  registerCurrentDeviceForPush,
} from '../lib/notifications';

export function PushNotificationBootstrap() {
  const router = useRouter();
  const { session, profile } = useAuth();

  useEffect(() => {
    if (!canUseNativePushNotifications()) return;

    void import('expo-notifications').then(Notifications => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    });
  }, []);

  useEffect(() => {
    if (!session?.user.id || !profile?.id || !profile.is_active) return;
    void registerCurrentDeviceForPush(session.user.id);
  }, [profile?.id, profile?.is_active, session?.user.id]);

  useEffect(() => {
    if (!canUseNativePushNotifications()) return;

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    void import('expo-notifications').then(Notifications => {
      if (cancelled) return;
      subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const route = notificationRoute(response.notification.request.content.data);
        if (route) router.push(route as any);
      });
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  return null;
}
