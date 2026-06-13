module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Scope the unistyles plugin to first-party source only. Applied to
    // node_modules it also transforms react-native-unistyles' own component
    // files (their paths contain "/components/") and remaps their `react-native`
    // imports back onto themselves, producing a self-referential module that
    // crashes on web ("Cannot access 'n' before initialization" on FlatList).
    // The function test excludes node_modules while processing all of our code.
    overrides: [
      {
        test: (filename) =>
          !!filename &&
          !filename.includes('node_modules') &&
          /[/\\](app|components|screens|lib|constants|hooks)[/\\]/.test(filename),
        plugins: [
          ['react-native-unistyles/plugin', {
            root: 'app',
            autoProcessPaths: ['components', 'screens', 'lib', 'constants', 'hooks'],
          }],
        ],
      },
    ],
  };
};
