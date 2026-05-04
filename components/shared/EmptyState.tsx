import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Ionicons name={icon} size={48} color="#D1D5DB" />
      <Text style={{ fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 12, textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          label={actionLabel}
          variant="secondary"
          onPress={onAction}
          style={{ marginTop: 20, paddingHorizontal: 24 }}
        />
      )}
    </View>
  );
}
