import { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#2F4A7D';
const PRIMARY_DARK = '#1E3158';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
};

function HeaderTexture() {
  return (
    <View style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' } as any}>
      <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, right: -78, top: -90, backgroundColor: 'rgba(255,255,255,0.055)' }} />
      <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, left: -64, bottom: -88, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
      <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, right: 48, top: -122, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }} />
      <View style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, right: 6, top: -156, borderWidth: 1, borderColor: 'rgba(255,255,255,0.045)' }} />
      <View style={{ position: 'absolute', left: 20, bottom: 30, width: 112, height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
      <View style={{ position: 'absolute', left: 20, bottom: 42, width: 68, height: 1, backgroundColor: 'rgba(255,255,255,0.11)' }} />
    </View>
  );
}

export function MainHeader({ title, subtitle, right, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar style="light" backgroundColor={PRIMARY} />
      <View style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: children ? 20 : 16, overflow: 'hidden' }}>
        <HeaderTexture />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: PRIMARY_DARK, opacity: 0.08, pointerEvents: 'none' } as any} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{title}</Text>
            {subtitle ? (
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
        {children ? (
          <View style={{ marginTop: 18 }}>
            {children}
          </View>
        ) : null}
      </View>
    </>
  );
}
