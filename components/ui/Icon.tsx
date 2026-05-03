import { Platform, type ColorValue } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';

export type IconName = {
  sf: SymbolViewProps['name'];
  ion: ComponentProps<typeof Ionicons>['name'];
};

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: ComponentProps<typeof Ionicons>['style'];
};

export function Icon({ name, size = 24, color, style }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name.sf}
        size={size}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={[{ width: size, height: size }, style]}
      />
    );
  }
  return <Ionicons name={name.ion} size={size} color={color as string} style={style} />;
}
