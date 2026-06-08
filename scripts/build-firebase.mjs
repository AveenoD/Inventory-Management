#!/usr/bin/env node
/**
 * Production static build for Firebase Hosting.
 * Output: build/web/  (gitignored)
 */
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps", "web");
const outDir = path.join(webDir, "out");
const targetDir = path.join(root, "build", "web");

function run(cmd, cwd = root, extraEnv = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

console.log("SK Mobile — Firebase Hosting build\n");

run("npm run build --workspace=@sk-mobile/shared");

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://sk-mobile-api.onrender.com";

run("npm run build", webDir, {
  FIREBASE_EXPORT: "1",
  NEXT_PUBLIC_API_URL: apiUrl,
});

if (!existsSync(outDir)) {
  console.error(`\nBuild failed: ${outDir} not found. Check Next.js static export errors.`);
  process.exit(1);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(path.join(root, "build"), { recursive: true });
cpSync(outDir, targetDir, { recursive: true });

console.log(`\n✓ Firebase build ready: build/web/`);
console.log(`  API URL baked in: ${apiUrl}`);
console.log("  Deploy: firebase deploy --only hosting");
