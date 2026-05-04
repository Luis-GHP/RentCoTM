import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = TouchableOpacityProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
};

const STYLES: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: '#1B3C34', text: '#FFFFFF' },
  secondary: { bg: 'transparent', text: '#1B3C34', border: '#1B3C34' },
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
          backgroundColor: isDisabled && variant === 'primary' ? '#E5E7EB' : s.bg,
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
            color: isDisabled && variant === 'primary' ? '#9CA3AF' : s.text,
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
