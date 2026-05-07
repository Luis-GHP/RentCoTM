import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = TouchableOpacityProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const STYLES: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: '#C34A1A', text: '#FFFFFF' },
  secondary: { bg: 'transparent', text: '#2F4A7D', border: '#2F4A7D' },
  danger:    { bg: 'transparent', text: '#DC2626', border: '#DC2626' },
};

export function Button({ label, variant = 'primary', loading = false, disabled, style, ...props }: Props) {
  const s = STYLES[variant as Variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      {...props}
      disabled={isDisabled}
      style={[
        {
          height: 52,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDisabled && variant === 'primary' ? '#E4E0DC' : s.bg,
          borderWidth: s.border ? 1.5 : 0,
          borderColor: isDisabled ? '#D1D5DB' : s.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : s.text} />
      ) : (
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: isDisabled ? '#9CA3AF' : s.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
