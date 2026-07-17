// Dashboard-side fetch for macOS companion data (proxied by background.js).

const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

export async function fetchDesktopDay(dateStr) {
  if (!hasChrome) return null;
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_DESKTOP_DAY", date: dateStr }, (res) => {
      if (chrome.runtime.lastError || !res?.ok) {
        resolve(null);
        return;
      }
      resolve(res.data);
    });
  });
}
