import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';

type Props = {
  label: string;
  value?: string;
  onPress?: () => void;
  showDivider?: boolean;
  valueColor?: string;
  right?: ReactNode;
};

export function ListRow({ label, value, onPress, showDivider = true, valueColor = '#111827', right }: Props) {
  const Row = onPress ? TouchableOpacity : View;

  return (
    <Row
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingVertical: 12,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: '#E4E0DC',
      }}
    >
      <Text style={{ flex: 1, fontSize: 13, color: '#6B7280' }}>{label}</Text>
      {right ?? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value ? (
            <Text style={{ fontSize: 15, color: valueColor, fontWeight: '400' }}>{value}</Text>
          ) : (
            <Text style={{ fontSize: 15, color: '#9CA3AF' }}>—</Text>
          )}
          {onPress && (
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          )}
        </View>
      )}
    </Row>
  );
}
