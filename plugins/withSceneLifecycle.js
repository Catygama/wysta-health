// iOS 27 SDK: apps must adopt the UIScene life cycle or UIKit kills them at
// launch ("UIScene life cycle is required for apps built with this SDK").
// Expo ships ExpoAppSceneDelegate for this, but the prebuild AppDelegate
// template still creates the window itself. This plugin:
//  - registers ExpoAppSceneDelegate in Info.plist (UIApplicationSceneManifest)
//  - makes AppDelegate an ExpoReactNativeFactoryProvider and drops its own
//    window/startReactNative, which the scene delegate now does.
// Drop it once the Expo template adopts scenes.
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const WINDOW_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\s*/;

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = c.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }
    if (WINDOW_BLOCK.test(src)) {
      src = src.replace(
        WINDOW_BLOCK,
        '    // ExpoAppSceneDelegate creates the window and starts React Native.\n\n    ',
      );
    }
    if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame:')) {
      throw new Error('withSceneLifecycle: AppDelegate template changed, update the plugin');
    }
    c.modResults.contents = src;
    return c;
  });
};
