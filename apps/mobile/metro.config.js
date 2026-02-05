const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_enableSymlinks: true,
  unstable_disableESMImportValidation: true,
  nodeModulesPaths: [],
  extraNodeModules: {},
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName.startsWith("node:")) {
      return { type: "empty" };
    }

    return context.resolveRequest
      ? context.resolveRequest(context, moduleName, platform)
      : null;
  },
};

config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

module.exports = config;
