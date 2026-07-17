// Dashboard-side fetch for macOS companion data (proxied by background.js).

const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

const DESKTOP_TIMEOUT_MS = 2500;

export async function fetchDesktopDay(dateStr) {
  if (!hasChrome) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), DESKTOP_TIMEOUT_MS);
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_DAY", date: dateStr }, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError || !res?.ok) {
        resolve(null);
        return;
      }
      resolve(res.data);
    });
  });
}
