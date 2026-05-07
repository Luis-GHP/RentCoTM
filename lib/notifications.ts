import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { getMonthName } from './format';

export type RentCoNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type NotificationTarget =
  | { type: 'user'; id: string }
  | { type: 'lease_tenants'; id: string }
  | { type: 'lease_landlords'; id: string }
  | { type: 'unit_tenants'; id: string }
  | { type: 'unit_landlords'; id: string }
  | { type: 'tenant_tenants'; id: string }
  | { type: 'tenant_landlords'; id: string }
  | { type: 'payment_landlords'; id: string }
  | { type: 'utility_tenants'; id: string }
  | { type: 'utility_landlords'; id: string }
  | { type: 'maintenance_tenants'; id: string }
  | { type: 'maintenance_landlords'; id: string };

export function notificationRoute(data: Record<string, unknown> | undefined) {
  const route = data?.route;
  return typeof route === 'string' && route.startsWith('/') ? route : null;
}

export function canUseNativePushNotifications() {
  return Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
}

function getExpoProjectId() {
  return Constants.easConfig?.projectId
    ?? Constants.expoConfig?.extra?.eas?.projectId
    ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? null;
}

export async function registerCurrentDeviceForPush(_userId: string) {
  if (!canUseNativePushNotifications()) return null;

  try {
    const projectId = getExpoProjectId();
    if (!projectId) {
      console.info('Push token registration skipped: add an EAS projectId before testing remote notifications.');
      return null;
    }

    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'RentCo updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2F4A7D',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const finalStatus = existing.status === 'granted'
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;

    if (finalStatus !== 'granted') return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc('update_own_push_token', {
      p_push_token: token.data,
    });
    if (error) throw error;

    return token.data;
  } catch (error) {
    console.warn('Could not register push token', error);
    return null;
  }
}

export async function sendRentCoNotification(userId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'user', id: userId }, payload);
}

async function sendTargetNotification(target: NotificationTarget, payload: RentCoNotificationPayload) {
  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: {
        target,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      },
    });
    if (error) throw error;
  } catch (error) {
    console.warn('Could not send notification', error);
  }
}

export async function notifyTenantsForLease(leaseId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'lease_tenants', id: leaseId }, payload);
}

export async function notifyTenantsForUnit(unitId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'unit_tenants', id: unitId }, payload);
}

export async function notifyLandlordsForUnit(unitId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'unit_landlords', id: unitId }, payload);
}

export async function notifyLandlordsForLease(leaseId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'lease_landlords', id: leaseId }, payload);
}

export async function notifyLandlordsForTenant(tenantId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'tenant_landlords', id: tenantId }, payload);
}

export async function notifyTenantForTenant(tenantId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'tenant_tenants', id: tenantId }, payload);
}

export async function notifyLandlordsForPayment(paymentId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'payment_landlords', id: paymentId }, payload);
}

export async function notifyTenantsForUtilityBill(billId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'utility_tenants', id: billId }, payload);
}

export async function notifyLandlordsForUtilityBill(billId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'utility_landlords', id: billId }, payload);
}

export async function notifyTenantsForMaintenanceRequest(requestId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'maintenance_tenants', id: requestId }, payload);
}

export async function notifyLandlordsForMaintenanceRequest(requestId: string, payload: RentCoNotificationPayload) {
  await sendTargetNotification({ type: 'maintenance_landlords', id: requestId }, payload);
}

export function paymentNotificationBody(periodMonth: number, periodYear: number) {
  return `${getMonthName(periodMonth)} ${periodYear}`;
}
