const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
// Hoisted workspace deps live at the monorepo root; list it first so packages nested
// under apps/captain-mobile/node_modules (e.g. expo-router) still resolve peers from root.
config.resolver.nodeModulesPaths = [
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(projectRoot, "node_modules"),
];

// Prefer workspace root, then this app (npm may place some packages only under the app).
function resolvePackageDir(pkgName) {
  const candidates = [
    path.join(workspaceRoot, "node_modules", ...pkgName.split("/")),
    path.join(projectRoot, "node_modules", ...pkgName.split("/")),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  }
  return null;
}

const extra = { ...(config.resolver.extraNodeModules ?? {}) };
const rnDir = resolvePackageDir("react-native");
if (rnDir) {
  extra["react-native"] = rnDir;
}
const atRnRoot = path.join(workspaceRoot, "node_modules", "@react-native");
const atRnProject = path.join(projectRoot, "node_modules", "@react-native");
for (const atRn of [atRnRoot, atRnProject]) {
  if (!fs.existsSync(atRn)) continue;
  for (const name of fs.readdirSync(atRn)) {
    const key = `@react-native/${name}`;
    if (extra[key]) continue;
    const pkgDir = path.join(atRn, name);
    if (fs.statSync(pkgDir).isDirectory() && fs.existsSync(path.join(pkgDir, "package.json"))) {
      extra[key] = pkgDir;
    }
  }
}
config.resolver.extraNodeModules = extra;

module.exports = config;
