#!/bin/bash
# Build, install to ~/Applications, register Chrome native host, and launch.
# Usage: ./install-companion.sh [chrome-extension-id]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MACOS_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_APP="$MACOS_DIR/DailyMirrorCompanion.app"
INSTALL_APP="$HOME/Applications/Daily Mirror.app"
HOST_NAME="com.dailymirror.companion"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"
HOST_EXECUTABLE="$INSTALL_APP/Contents/Helpers/native-host"

EXT_ID="${1:-${DAILY_MIRROR_EXTENSION_ID:-}}"

"$SCRIPT_DIR/bundle-app.sh"

echo "Installing to $INSTALL_APP..."
rm -rf "$INSTALL_APP"
ditto "$BUILD_APP" "$INSTALL_APP"
xattr -dr com.apple.quarantine "$INSTALL_APP" 2>/dev/null || true

if [[ ! -x "$HOST_EXECUTABLE" ]]; then
  echo "Install failed: missing host helper at $HOST_EXECUTABLE" >&2
  exit 1
fi

if [[ -z "$EXT_ID" ]]; then
  echo ""
  echo "App installed. Chrome extension ID not provided — native host not registered."
  echo "Find your ID at chrome://extensions (Developer mode), then run:"
  echo "  $0 YOUR_EXTENSION_ID"
else
  mkdir -p "$MANIFEST_DIR"
  cat > "$MANIFEST_PATH" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Daily Mirror macOS companion — desktop app activity for Chrome extension",
  "path": "$HOST_EXECUTABLE",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXT_ID}/"
  ]
}
EOF
  echo ""
  echo "Installed native messaging host:"
  echo "  $MANIFEST_PATH"
  echo "  Helper: $HOST_EXECUTABLE"
  echo ""
  echo "Restart Chrome after installing or reloading the extension."
fi

echo "Launching Daily Mirror..."
open "$INSTALL_APP"

echo ""
echo "Look for the clock icon in the menu bar (top-right)."
echo "Enable Open at Login from the menu to keep capturing after reboot."
