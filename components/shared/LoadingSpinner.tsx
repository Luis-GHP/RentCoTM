import { View, ActivityIndicator } from 'react-native';

type Props = {
  fullScreen?: boolean;
};

export function LoadingSpinner({ fullScreen = false }: Props) {
  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        padding: fullScreen ? 0 : 32,
      }}
    >
      <ActivityIndicator size="large" color="#2F4A7D" />
    </View>
  );
}
