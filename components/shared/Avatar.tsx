import { View, Text } from 'react-native';
import { getInitials, avatarColor } from '../../lib/format';

type Props = { name: string; size?: number };

export function Avatar({ name, size = 40 }: Props) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: avatarColor(name),
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.36 }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
