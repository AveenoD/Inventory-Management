#!/usr/bin/env node
/**
 * Local APK build. Windows MUST use short path C:\SM (junction to repo).
 * One run only: npm run build:apk:local
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isWin = process.platform === "win32";
const realRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHORT = isWin ? "C:\\SM" : realRoot;
const android = path.join(SHORT, "apps", "mobile", "android");
const gradlew = path.join(android, "gradlew.bat");
const outApk = path.join(realRoot, "build", "android", "sk-mobile-preview.apk");
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const jbr = "C:\\Program Files\\Android\\Android Studio\\jbr";

if (!existsSync(path.join(sdk, "ndk", "27.1.12297006"))) {
  console.error("NDK 27.1 missing. Android Studio → SDK Manager → NDK (Side by side) → Apply");
  process.exit(1);
}

if (isWin && !existsSync(SHORT)) {
  console.error('Run once as admin: mklink /J "C:\\SM" "D:\\Office\\SK MOBILE"');
  process.exit(1);
}

writeFileSync(path.join(SHORT, "apps", "mobile", ".env"), "EXPO_PUBLIC_API_URL=https://sk-mobile-api.onrender.com\n");
writeFileSync(path.join(android, "local.properties"), `sdk.dir=${sdk.replace(/\\/g, "/")}\n`);

const gp = path.join(android, "gradle.properties");
let g = readFileSync(gp, "utf8");
if (!g.includes("android.overridePathCheck=true")) g += "\nandroid.overridePathCheck=true\n";
g = g.replace(/reactNativeArchitectures=.+/m, "reactNativeArchitectures=arm64-v8a");
g = g.replace(/org\.gradle\.parallel=.+/m, "org.gradle.parallel=false");
if (!g.includes("org.gradle.workers.max=1")) g += "org.gradle.workers.max=1\n";
writeFileSync(gp, g);

const env = {
  ...process.env,
  JAVA_HOME: jbr,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  NODE_BINARY: process.execPath,
  NODE_ENV: "production",
  PATH: `${jbr}\\bin;${path.dirname(process.execPath)};${process.env.PATH}`,
};

console.log("Building from short path:", android);
console.log("Output:", outApk, "\n");

const t0 = Date.now();
execSync(`"${gradlew}" assembleRelease --console=plain --max-workers=1`, {
  cwd: android,
  stdio: "inherit",
  env,
  shell: true,
});

const built = path.join(android, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(built)) {
  console.error("Build finished but APK not found");
  process.exit(1);
}

mkdirSync(path.dirname(outApk), { recursive: true });
copyFileSync(built, outApk);
console.log(`\n✓ DONE ${((Date.now() - t0) / 60000).toFixed(1)} min → ${outApk} (${(statSync(outApk).size / 1048576).toFixed(1)} MB)`);
