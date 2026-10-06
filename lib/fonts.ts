import {
  useFonts,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';

// Font family names to use in styles. System body font is the platform default
// (undefined fontFamily => SF / Roboto / system-ui), styled with fontWeight.
// Display (titles, greeting, wordmark) uses Fraunces, a soft serif.
export const fonts = {
  displayBold: 'Fraunces_600SemiBold',
  displayExtraBold: 'Fraunces_700Bold',
} as const;

export function useBrandFonts() {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  return loaded;
}
