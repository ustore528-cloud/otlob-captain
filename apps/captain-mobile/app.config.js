// Without this, Expo resolves the Metro server root to the monorepo workspace root
// (`resolve-workspace-root`) while Android `export:embed` still passes `--entry-file index.js`,
// so Metro tries `./index.js` from the repo root and release bundling fails.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = "1";

// EAS file secret GOOGLE_SERVICES_JSON (bare workflow Firebase file is gitignored).
const appJson = require("./app.json");

module.exports = () => ({
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
  },
});
