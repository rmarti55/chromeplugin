#!/bin/bash
# Install the Daily Mirror native messaging host for Chrome.
# Usage: ./install-native-host.sh [chrome-extension-id]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MACOS_DIR="$(dirname "$SCRIPT_DIR")"
HOST_NAME="com.dailymirror.companion"
HOST_SCRIPT="$SCRIPT_DIR/daily-mirror-host.sh"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"

"$SCRIPT_DIR/bundle-app.sh"
chmod +x "$HOST_SCRIPT"

if [[ ! -x "$HOST_SCRIPT" ]]; then
  echo "Missing host script: $HOST_SCRIPT" >&2
  exit 1
fi

EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Chrome extension ID not provided."
  echo "Find it at chrome://extensions (Developer mode) and re-run:"
  echo "  $0 YOUR_EXTENSION_ID"
  exit 1
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_PATH" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Daily Mirror macOS companion — desktop app activity for Chrome extension",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXT_ID}/"
  ]
}
EOF

echo "Installed native messaging host:"
echo "  $MANIFEST_PATH"
echo "  Script: $HOST_SCRIPT"
echo ""
echo "Launch menu bar tracker:"
echo "  open $MACOS_DIR/DailyMirrorCompanion.app"
echo ""
echo "Restart Chrome after installing."
