import { Image } from 'react-native';

// The app icon (wisteria on wine, assets/brand/icon.svg → assets/images/icon.png)
// as an in-app brand mark. The PNG is full-bleed, so round it like an app icon.
const ICON = require('@/assets/images/icon.png');

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={ICON}
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}
