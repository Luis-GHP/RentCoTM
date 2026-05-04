import { View, ViewProps } from 'react-native';

type Props = ViewProps & {
  padded?: boolean;
};

export function Card({ padded = true, style, children, ...props }: Props) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          padding: padded ? 16 : 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
