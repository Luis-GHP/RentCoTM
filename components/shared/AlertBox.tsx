import { StyleProp, ViewStyle } from 'react-native';
import { PromptBanner } from './PromptBanner';

type Variant = 'error' | 'warning' | 'info' | 'success';

type Props = {
  message: string;
  variant?: Variant;
  type?: Variant;
  style?: StyleProp<ViewStyle>;
};

export function AlertBox({ message, variant, type, style }: Props) {
  return (
    <PromptBanner
      tone={variant ?? type ?? 'error'}
      message={message}
      style={style}
    />
  );
}
