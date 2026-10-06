import { Platform, View, type ColorValue } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { Glyph, type GlyphName } from '@/components/ui/glyphs';

export type IconName = {
  sf: SymbolViewProps['name'];
  ion: ComponentProps<typeof Ionicons>['name'];
  /** Custom SVG glyph (components/ui/glyphs); overrides sf/ion on every platform. */
  glyph?: GlyphName;
};

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: ComponentProps<typeof Ionicons>['style'];
  /**
   * Spoken name. Omit for decorative icons (the default): they are hidden from
   * screen readers, so the surrounding control must carry the label instead.
   */
  accessibilityLabel?: string;
};

export function Icon({ name, size = 24, color, style, accessibilityLabel }: Props) {
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, 'aria-hidden': true };

  if (name.glyph) {
    return (
      <View {...a11y} style={[{ width: size, height: size }, style as any]}>
        <Glyph name={name.glyph} size={size} color={color ?? '#000'} />
      </View>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        {...a11y}
        name={name.sf}
        size={size}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={[{ width: size, height: size }, style]}
      />
    );
  }
  return (
    <Ionicons {...a11y} name={name.ion} size={size} color={color as string} style={style} />
  );
}
