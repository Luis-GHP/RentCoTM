import { Image, ImageSourcePropType, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

type BrandTone = 'white' | 'blue';

const LOGOS: Record<BrandTone, { mark: ImageSourcePropType; text: ImageSourcePropType; textRatio: number }> = {
  white: {
    mark: require('../../assets/images/rentco-mark-white.png'),
    text: require('../../assets/images/rentco-text-white.png'),
    textRatio: 860 / 3105,
  },
  blue: {
    mark: require('../../assets/images/rentco-mark-blue.png'),
    text: require('../../assets/images/rentco-text-blue.png'),
    textRatio: 642 / 1706,
  },
};

type WordmarkProps = {
  tone?: BrandTone;
  markSize?: number;
  textWidth?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

type MarkProps = {
  tone?: BrandTone;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

type TextProps = {
  tone?: BrandTone;
  width?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandWordmark({ tone = 'white', markSize = 38, textWidth = 126, gap = 10, style }: WordmarkProps) {
  const logo = LOGOS[tone];

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <Image
        source={logo.mark}
        resizeMode="contain"
        style={{ width: markSize, height: markSize, marginRight: gap }}
      />
      <Image
        source={logo.text}
        resizeMode="contain"
        style={{ width: textWidth, height: textWidth * logo.textRatio }}
      />
    </View>
  );
}

export function BrandMark({ tone = 'white', size = 38, style }: MarkProps) {
  return (
    <Image
      source={LOGOS[tone].mark}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}

export function BrandText({ tone = 'white', width = 126, style }: TextProps) {
  const logo = LOGOS[tone];

  return (
    <Image
      source={logo.text}
      resizeMode="contain"
      style={[{ width, height: width * logo.textRatio }, style]}
    />
  );
}
