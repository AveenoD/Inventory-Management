#!/usr/bin/env node
/**
 * Build Android APK via EAS (Expo Application Services) and save to build/android/
 *
 * Prerequisites (one-time):
 *   npx eas-cli login
 *   cd apps/mobile && npx eas-cli init
 *
 * Usage:
 *   npm run build:apk
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileDir = path.join(root, "apps", "mobile");
const outDir = path.join(root, "build", "android");
const apkName = "sk-mobile-preview.apk";
const apkPath = path.join(outDir, apkName);

const eas = "npx eas-cli@latest";

function run(cmd, cwd = root, inherit = true) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, {
    cwd,
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
    env: { ...process.env },
  });
}

function runCapture(cmd, cwd = root) {
  return execSync(cmd, { cwd, encoding: "utf8", env: { ...process.env } }).trim();
}

function ensureLoggedIn() {
  try {
    const user = runCapture(`${eas} whoami`, root);
    console.log(`EAS logged in as: ${user}`);
    return true;
  } catch {
    console.error(`
✗ Not logged in to Expo/EAS.

Run once (browser opens):
  npx eas-cli login

Then link this project (first time only):
  cd apps/mobile
  npx eas-cli init

Then run again from repo root:
  npm run build:apk
`);
    process.exit(1);
  }
}

function isValidEasProjectId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function ensureProjectLinked() {
  const appJsonPath = path.join(mobileDir, "app.json");
  const app = JSON.parse(readFileSync(appJsonPath, "utf8"));
  const projectId = app.expo?.extra?.eas?.projectId;
  const needsLink =
    !projectId ||
    projectId === "YOUR_EAS_PROJECT_ID" ||
    !isValidEasProjectId(projectId);

  if (needsLink) {
    if (app.expo?.extra?.eas) {
      delete app.expo.extra.eas;
      writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);
      console.log("\nRemoved invalid EAS projectId from app.json");
    }
    console.log("Linking EAS project (first time)…");
    run(`${eas} init --non-interactive`, mobileDir);
  }
}

function findApk(dir) {
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const found = findApk(full);
      if (found) return found;
    } else if (name.endsWith(".apk")) {
      return full;
    }
  }
  return null;
}

console.log("SK Mobile — Android APK build (EAS preview)\n");
console.log(`Output: ${apkPath}\n`);

ensureLoggedIn();
ensureProjectLinked();

mkdirSync(outDir, { recursive: true });

// Cloud build (APK) — ~10–20 min on Expo servers
run(
  `${eas} build --platform android --profile preview --non-interactive --wait`,
  mobileDir,
);

// Download latest finished build into build/android/
try {
  rmSync(apkPath, { force: true });
  run(`${eas} build:download --platform android --latest --output "${apkPath}"`, mobileDir);
} catch {
  console.log("\nTrying alternate download path…");
  run(`${eas} build:download --latest --output "${apkPath}"`, mobileDir);
}

if (!existsSync(apkPath)) {
  const fallback = findApk(mobileDir);
  if (fallback) {
    copyFileSync(fallback, apkPath);
  }
}

if (!existsSync(apkPath)) {
  console.error(`\n✗ APK not found at ${apkPath}`);
  console.error("Download manually from https://expo.dev → your project → Builds");
  process.exit(1);
}

const sizeMb = (statSync(apkPath).size / (1024 * 1024)).toFixed(1);
console.log(`\n✓ APK ready (${sizeMb} MB)`);
console.log(`  ${apkPath}`);
console.log("\nFirebase App Distribution:");
console.log("  Upload this file → Release & Monitor → App Distribution → Distribute");
