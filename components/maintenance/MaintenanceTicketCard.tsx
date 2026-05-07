import { Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../shared/StatusBadge';

const PRIMARY = '#2F4A7D';

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 10px 16px rgba(15, 23, 42, 0.08)' },
  default: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
});

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  plumbing: 'water-outline',
  electrical: 'flash-outline',
  structural: 'construct-outline',
  appliance: 'tv-outline',
  pest: 'bug-outline',
  cleaning: 'sparkles-outline',
  internet: 'wifi-outline',
  other: 'hammer-outline',
};

const PRIORITY_TONE: Record<string, { bg: string; color: string; label: string }> = {
  emergency: { bg: '#FEF2F2', color: '#DC2626', label: 'Emergency' },
  high: { bg: '#FFF7ED', color: '#EA580C', label: 'High' },
  medium: { bg: '#FFFBEB', color: '#B45309', label: 'Medium' },
  low: { bg: '#F1EFEC', color: '#6B7280', label: 'Low' },
};

const STATUS_STAGE: Record<string, number> = {
  open: 0,
  assigned: 1,
  in_progress: 1,
  resolved: 2,
  closed: 3,
};

const STAGES = ['Reported', 'Review', 'Fixed', 'Confirmed'];

function titleCase(value: string) {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ProgressTrack({ status }: { status: string }) {
  const activeIndex = STATUS_STAGE[status] ?? 0;

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
        {STAGES.map((stage, index) => {
          const active = index <= activeIndex;
          return (
            <View key={stage} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                <View style={{ flex: 1, height: 2, backgroundColor: index === 0 ? 'transparent' : active ? '#D7E3F6' : '#E4E0DC' }} />
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: active ? PRIMARY : '#D1D5DB' }} />
                <View style={{ flex: 1, height: 2, backgroundColor: index === STAGES.length - 1 ? 'transparent' : index < activeIndex ? '#D7E3F6' : '#E4E0DC' }} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '800', color: active ? PRIMARY : '#9CA3AF', marginTop: 6 }}>
                {stage}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PhotoThumb({ thumbnailUrl, photoCount }: { thumbnailUrl?: string | null; photoCount?: number }) {
  if (!thumbnailUrl) return null;

  return (
    <View style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden', marginLeft: 10, backgroundColor: '#E4E0DC' }}>
      <Image source={{ uri: thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      {photoCount && photoCount > 1 ? (
        <View style={{ position: 'absolute', right: 5, bottom: 5, borderRadius: 999, backgroundColor: 'rgba(17,24,39,0.78)', paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>+{photoCount - 1}</Text>
        </View>
      ) : null}
    </View>
  );
}

export type MaintenanceTicketCardProps = {
  title: string;
  category: string;
  priority: string;
  status: string;
  createdLabel: string;
  durationLabel?: string;
  locationLabel?: string;
  thumbnailUrl?: string | null;
  photoCount?: number;
  onPress: () => void;
};

export function MaintenanceTicketCard({
  title,
  category,
  priority,
  status,
  createdLabel,
  durationLabel,
  locationLabel,
  thumbnailUrl,
  photoCount,
  onPress,
}: MaintenanceTicketCardProps) {
  const icon = CATEGORY_ICON[category] ?? CATEGORY_ICON.other;
  const priorityTone = PRIORITY_TONE[priority] ?? PRIORITY_TONE.medium;
  const meta = [createdLabel, durationLabel].filter(Boolean).join(' - ');

  return (
    <TouchableOpacity
      activeOpacity={0.76}
      onPress={onPress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E4E0DC',
        padding: 16,
        marginBottom: 12,
        ...CARD_SHADOW,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={icon} size={20} color={PRIMARY} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '900', color: '#111827' }} numberOfLines={1}>
              {title}
            </Text>
            <StatusBadge status={status} />
          </View>

          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }} numberOfLines={1}>
            {locationLabel ?? titleCase(category)}
          </Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
            {meta}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 8 }}>
            <View style={{ borderRadius: 999, backgroundColor: priorityTone.bg, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ color: priorityTone.color, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{priorityTone.label}</Text>
            </View>
            {thumbnailUrl ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="camera-outline" size={13} color="#6B7280" />
                <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '700', marginLeft: 4 }}>
                  {photoCount && photoCount > 1 ? `${photoCount} photos` : 'Photo'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <PhotoThumb thumbnailUrl={thumbnailUrl} photoCount={photoCount} />

        <View style={{ marginLeft: 8, paddingTop: 19 }}>
          <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
        </View>
      </View>

      <ProgressTrack status={status} />
    </TouchableOpacity>
  );
}
