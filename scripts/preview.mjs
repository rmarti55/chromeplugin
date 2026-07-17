#!/usr/bin/env node
/**
 * Preview Daily Mirror: bundle companion, install native host, load extension, open dashboard.
 */
import { spawn, execSync } from "child_process";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_PATH = join(ROOT, "extension");
const APP_PATH = join(ROOT, "macos", "DailyMirrorCompanion.app");
const APP_BIN = join(APP_PATH, "Contents", "MacOS", "DailyMirrorCompanion");
const PROFILE = "/tmp/daily-mirror-preview";
const PORT = 9222;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpSend(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1e9);
  return new Promise((resolve, reject) => {
    const onMsg = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMsg);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function installHost(extensionId, hostDir) {
  mkdirSync(hostDir, { recursive: true });
  const manifest = {
    name: "com.dailymirror.companion",
    description: "Daily Mirror macOS companion",
    path: APP_BIN,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
    args: ["--native-host"],
  };
  writeFileSync(join(hostDir, "com.dailymirror.companion.json"), JSON.stringify(manifest, null, 2));
}

async function main() {
  console.log("Building dashboard…");
  execSync("npm run build", { cwd: join(ROOT, "extension", "dashboard"), stdio: "inherit" });

  console.log("Bundling macOS companion…");
  execSync("bash Scripts/bundle-app.sh", { cwd: join(ROOT, "macos"), stdio: "inherit" });

  if (!existsSync(APP_BIN)) throw new Error(`Missing app binary: ${APP_BIN}`);

  console.log("Launching menu bar companion…");
  spawn("open", [APP_PATH], { detached: true, stdio: "ignore" }).unref();
  await sleep(1500);

  console.log("Starting Chrome preview profile…");
  spawn(
    CHROME,
    [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, "--no-first-run", "about:blank"],
    { detached: true, stdio: "ignore" }
  ).unref();

  await sleep(2500);

  const versionRes = await fetch(`http://127.0.0.1:${PORT}/json/version`);
  if (!versionRes.ok) throw new Error("Chrome debug port not ready");
  const { webSocketDebuggerUrl } = await versionRes.json();

  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  console.log("Loading unpacked extension…");
  const loadResult = await cdpSend(ws, "Extensions.loadUnpacked", { path: EXT_PATH });
  const extensionId = loadResult?.id;
  if (!extensionId) throw new Error("No extension ID returned from CDP");

  console.log("Extension ID:", extensionId);

  const mainHostDir = join(process.env.HOME, "Library/Application Support/Google/Chrome/NativeMessagingHosts");
  installHost(extensionId, mainHostDir);
  installHost(extensionId, join(PROFILE, "NativeMessagingHosts"));

  const dashboardUrl = `chrome-extension://${extensionId}/dashboard/dist/index.html`;
  console.log("Opening dashboard:", dashboardUrl);
  spawn(CHROME, [`--user-data-dir=${PROFILE}`, dashboardUrl], { detached: true, stdio: "ignore" }).unref();

  ws.close();

  console.log("\nReady.");
  console.log("- Menu bar: look for Daily Mirror (clock icon) top-right");
  console.log("- Dashboard opened in preview Chrome profile");
  console.log("- For main Chrome: reload extension at chrome://extensions, then reopen dashboard");
  console.log(`- Native host installed for extension ID ${extensionId}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
