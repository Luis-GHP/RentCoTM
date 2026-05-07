import { Platform, View, ViewProps } from 'react-native';

type Props = ViewProps & {
  padded?: boolean;
};

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)' },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
});

export function Card({ padded = true, style, children, ...props }: Props) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          padding: padded ? 16 : 0,
          ...CARD_SHADOW,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
