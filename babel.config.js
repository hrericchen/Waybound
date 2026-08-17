module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 requires the worklets babel plugin instead of the old reanimated plugin.
    // This must remain the LAST plugin in the list.
    plugins: ['react-native-worklets/plugin'],
  };
};


