// Without this, Expo resolves the Metro server root to the monorepo workspace root
// (`resolve-workspace-root`) while Android `export:embed` still passes `--entry-file index.js`,
// so Metro tries `./index.js` from the repo root and release bundling fails.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

module.exports = require("./app.json");
