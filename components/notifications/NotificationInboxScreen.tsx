import { Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertBox } from '../shared/AlertBox';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { EmptyState } from '../shared/EmptyState';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { NotificationEvent, useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationEvents } from '../../lib/query/notifications';
import { formatDate } from '../../lib/format';
import { notificationRoute } from '../../lib/notifications';

const PRIMARY = '#2F4A7D';

function iconForNotification(notification: NotificationEvent): keyof typeof Ionicons.glyphMap {
  const type = typeof notification.data?.type === 'string' ? notification.data.type : '';
  if (type.includes('payment') || type.includes('receipt')) return 'receipt-outline';
  if (type.includes('maintenance')) return 'construct-outline';
  if (type.includes('utility')) return 'flash-outline';
  if (type.includes('identity') || type.includes('verification')) return 'shield-checkmark-outline';
  if (type.includes('invite')) return 'person-add-outline';
  return 'notifications-outline';
}

export function NotificationInboxScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { data: notifications, isLoading, error } = useNotificationEvents();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = (notifications ?? []).filter(item => !item.read_at).length;

  async function openNotification(notification: NotificationEvent) {
    if (!notification.read_at) {
      await markRead.mutateAsync(notification.id);
    }
    const route = notificationRoute(notification.data);
    if (route) router.push(route as any);
  }

  function goBack() {
    if (from === 'profile') {
      router.replace('/(tenant)/more' as any);
      return;
    }
    router.back();
  }

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1EFEC', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Notifications</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{unreadCount} unread</Text>
        </View>
      </View>

      {error ? (
        <View style={{ padding: 16 }}>
          <AlertBox type="error" message="Could not load notification history. Run SQL 16 if this is the first time testing notifications." />
        </View>
      ) : (notifications ?? []).length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No Notifications Yet"
          subtitle="Payment, maintenance, utility, and invite updates will appear here."
        />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {unreadCount > 0 ? (
            <Button
              label="Mark All Read"
              variant="secondary"
              loading={markAllRead.isPending}
              onPress={() => markAllRead.mutate()}
              style={{ marginBottom: 14 }}
            />
          ) : null}

          <Card padded={false}>
            {notifications!.map((notification, index) => {
              const unread = !notification.read_at;
              const route = notificationRoute(notification.data);
              return (
                <TouchableOpacity
                  key={notification.id}
                  onPress={() => openNotification(notification)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: index < notifications!.length - 1 ? 1 : 0,
                    borderBottomColor: '#F1EFEC',
                    backgroundColor: unread ? '#EDF3FF' : '#fff',
                  }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: unread ? '#EDF3FF' : '#F1EFEC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={iconForNotification(notification)} size={19} color={unread ? PRIMARY : '#6B7280'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: unread ? '900' : '700', color: '#111827' }} numberOfLines={1}>{notification.title}</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={2}>{notification.body}</Text>
                    <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>{formatDate(notification.created_at)}</Text>
                  </View>
                  {route ? <Ionicons name="chevron-forward" size={17} color="#9CA3AF" /> : null}
                </TouchableOpacity>
              );
            })}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
