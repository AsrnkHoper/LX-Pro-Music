const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const exclusionList = require('metro-config/src/defaults/exclusionList')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      // crypto: require.resolve('react-native-quick-crypto'),
      // stream: require.resolve('stream-browserify'),
      buffer: require.resolve('@craftzdog/react-native-buffer'),
    },
    blockList: exclusionList([
      /\.build-env[\\/].*/,
      /android[\\/]\.gradle[\\/].*/,
    ]),
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
