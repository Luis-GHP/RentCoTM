import { ComponentProps } from 'react';
import { Text, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Tone = 'guidance' | 'success' | 'warning' | 'error' | 'info';
type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  tone?: Tone;
  title?: string;
  message: string;
  solid?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

const PRIMARY = '#2F4A7D';

const SOFT: Record<Tone, { bg: string; border: string; text: string; icon: string; iconName: IconName }> = {
  guidance: { bg: '#EDF3FF', border: '#D8E2F2', text: '#2F4A7D', icon: '#2F4A7D', iconName: 'leaf-outline' },
  success:  { bg: '#EAF7EF', border: '#BDE7CB', text: '#14804A', icon: '#14804A', iconName: 'checkmark-circle-outline' },
  warning:  { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#B45309', iconName: 'time-outline' },
  error:    { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', icon: '#DC2626', iconName: 'alert-circle-outline' },
  info:     { bg: '#EDF3FF', border: '#D8E2F2', text: '#2F4A7D', icon: '#2F4A7D', iconName: 'information-circle-outline' },
};

export function PromptBanner({ tone = 'guidance', title, message, solid = false, icon, style }: Props) {
  const colors = SOFT[tone];
  const solidBrand = solid && tone === 'guidance';
  const bg = solidBrand ? PRIMARY : colors.bg;
  const border = solidBrand ? '#3F5F95' : colors.border;
  const text = solidBrand ? '#FFFFFF' : colors.text;
  const iconColor = solidBrand ? '#FFFFFF' : colors.icon;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          borderRadius: 14,
          paddingHorizontal: 13,
          paddingVertical: 12,
          marginBottom: 14,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: solidBrand ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: title ? 1 : -1,
        }}
      >
        <Ionicons name={icon ?? colors.iconName} size={15} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        {title ? (
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '800', color: text, marginBottom: 1 }}>
            {title}
          </Text>
        ) : null}
        <Text style={{ fontSize: 13, lineHeight: 19, color: text, fontWeight: solidBrand ? '600' : '500' }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
