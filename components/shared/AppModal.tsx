import { ComponentProps, ReactNode } from 'react';
import { Modal, Platform, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

type Tone = 'success' | 'warning' | 'danger' | 'info';
type ButtonVariant = 'primary' | 'secondary' | 'danger';
type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: Tone;
  icon?: IconName;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
};

const TONES: Record<Tone, { bg: string; color: string; icon: IconName }> = {
  success: { bg: '#EAF7EF', color: '#14804A', icon: 'checkmark-circle-outline' },
  warning: { bg: '#FFFBEB', color: '#B45309', icon: 'alert-circle-outline' },
  danger:  { bg: '#FEF2F2', color: '#DC2626', icon: 'alert-circle-outline' },
  info:    { bg: '#EDF3FF', color: '#2F4A7D', icon: 'information-circle-outline' },
};
const MODAL_SHADOW = Platform.select({
  web: { boxShadow: '0px 14px 24px rgba(17, 24, 39, 0.18)' },
  default: {
    shadowColor: '#111827',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
});

export function AppModal({
  visible,
  title,
  message,
  tone = 'info',
  icon,
  confirmLabel = 'OK',
  cancelLabel,
  confirmVariant = 'primary',
  loading = false,
  children,
  onConfirm,
  onCancel,
}: Props) {
  const style = TONES[tone];
  const close = onCancel ?? onConfirm;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(17,24,39,0.42)',
          justifyContent: 'center',
          padding: 22,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 22,
            padding: 20,
            ...MODAL_SHADOW,
          }}
        >
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: style.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Ionicons name={icon ?? style.icon} size={27} color={style.color} />
          </View>

          <Text style={{ fontSize: 19, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
            {title}
          </Text>
          {message ? (
            <Text style={{ fontSize: 14, lineHeight: 21, color: '#6B7280', marginBottom: children ? 14 : 18 }}>
              {message}
            </Text>
          ) : null}
          {children}

          <View style={{ flexDirection: cancelLabel ? 'row' : 'column', gap: 10, marginTop: children ? 18 : 0 }}>
            {cancelLabel ? (
              <Button
                label={cancelLabel}
                variant="secondary"
                onPress={onCancel ?? onConfirm}
                disabled={loading}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              label={confirmLabel}
              variant={confirmVariant}
              loading={loading}
              onPress={onConfirm}
              style={cancelLabel ? { flex: 1 } : undefined}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
