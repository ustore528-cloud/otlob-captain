/**
 * Bare workflow: EAS file secret GOOGLE_SERVICES_JSON is a path on the builder.
 * Gradle expects android/app/google-services.json; gitignored files are not in the archive.
 */
const fs = require("fs");
const path = require("path");

const mobileRoot = path.join(__dirname, "..");
const dest = path.join(mobileRoot, "android", "app", "google-services.json");
const fromSecret = process.env.GOOGLE_SERVICES_JSON;
const fromRoot = path.join(mobileRoot, "google-services.json");

try {
  if (fromSecret && fs.existsSync(fromSecret)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(fromSecret, dest);
    console.log("[eas-copy-google-services] Copied GOOGLE_SERVICES_JSON to android/app.");
  } else if (fs.existsSync(fromRoot)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(fromRoot, dest);
    console.log("[eas-copy-google-services] Copied ./google-services.json to android/app.");
  } else {
    console.warn(
      "[eas-copy-google-services] No GOOGLE_SERVICES_JSON or google-services.json; skipping.",
    );
  }
} catch (e) {
  console.error("[eas-copy-google-services]", e);
  process.exitCode = 1;
}
