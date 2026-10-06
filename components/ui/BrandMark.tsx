import { Image } from 'react-native';

// App icon (dark/main variant, wisteria on maroon). Source: brand sheet;
// the PNG already has rounded corners, so no extra styling is needed.
const ICON = require('@/assets/brand/icon-dark-192.png');

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={ICON}
      style={{ width: size, height: size }}
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}
