// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const coreSdkRoot = path.resolve(__dirname, '../core-sdk');
const coreSdkEntry = path.join(coreSdkRoot, 'dist', 'index.js');

/**
 * core-sdk is consumed from outside this project directory (file:../core-sdk),
 * so Metro has to be told it may follow symlinks/junctions out to it and watch it.
 */
config.watchFolders = [coreSdkRoot];
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@beorchid/core-sdk': coreSdkRoot,
};

/**
 * `jose` is redirected to a local stand-in. It arrives only because core-sdk's
 * barrel re-exports ./verify; this app never verifies a token itself, and
 * neither of jose's builds can run under React Native. The reasoning, and the
 * fix that belongs in core-sdk instead, are written out in src/shims/jose.ts.
 */
const joseShim = path.resolve(__dirname, 'src/shims/jose.ts');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@beorchid/core-sdk') {
    return { type: 'sourceFile', filePath: coreSdkEntry };
  }
  if (moduleName === 'jose') {
    return { type: 'sourceFile', filePath: joseShim };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
