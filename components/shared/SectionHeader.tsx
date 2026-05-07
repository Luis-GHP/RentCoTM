import { View, Text, TouchableOpacity } from 'react-native';

type Props = {
  title: string;
  onViewAll?: () => void;
};

export function SectionHeader({ title, onViewAll }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827' }}>{title}</Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#C34A1A' }}>View all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
