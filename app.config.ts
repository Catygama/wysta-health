import type { ConfigContext, ExpoConfig } from 'expo/config';

// APP_VARIANT=development (set by the dev-client build profiles in eas.json)
// produces "Wysta Dev" with its own identifiers, so it installs alongside the
// public app and gets its own TestFlight entry. Everything else is app.json.
const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_DEV) return config as ExpoConfig;
  return {
    ...config,
    name: 'Wysta Dev',
    slug: config.slug!,
    scheme: 'wysta-dev',
    // "DEV" ribbon on the icons so it's easy to tell apart from the public app.
    icon: './assets/images/icon-dev.png',
    ios: { ...config.ios, bundleIdentifier: 'health.wysta.app.dev' },
    android: {
      ...config.android,
      package: 'health.wysta.app.dev',
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: './assets/images/adaptive-icon-dev.png',
      },
    },
  };
};
