import { View, Text } from 'react-native';

type Variant = 'error' | 'warning' | 'info' | 'success';

type Props = {
  message: string;
  variant?: Variant;
};

const STYLES: Record<Variant, { bg: string; border: string; text: string }> = {
  error:   { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A' },
};

export function AlertBox({ message, variant = 'error' }: Props) {
  const s = STYLES[variant];
  return (
    <View
      style={{
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: s.border,
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 13, color: s.text }}>{message}</Text>
    </View>
  );
}
