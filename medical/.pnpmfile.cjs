const typescript6 = "npm:@typescript/typescript6@6.0.2";

const typescript6Consumers = new Set([
  "typescript-eslint",
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "@typescript-eslint/project-service",
  "@typescript-eslint/tsconfig-utils",
  "@typescript-eslint/type-utils",
  "@typescript-eslint/typescript-estree",
  "@typescript-eslint/utils",
]);

function readPackage(pkg) {
  if (!typescript6Consumers.has(pkg.name) || !pkg.peerDependencies?.typescript) {
    return pkg;
  }

  pkg.dependencies = {
    ...pkg.dependencies,
    typescript: typescript6,
  };
  delete pkg.peerDependencies.typescript;
  if (pkg.peerDependenciesMeta?.typescript) {
    delete pkg.peerDependenciesMeta.typescript;
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
