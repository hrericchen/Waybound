const createExpoWebpackConfig = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfig(env, argv);
  
  // Exclude @react-native-firebase from web bundle
  config.resolve.alias = {
    ...config.resolve.alias,
    '@react-native-firebase/app': false,
    '@react-native-firebase/auth': false,
  };
  
  return config;
};