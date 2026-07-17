#!/bin/bash
# Install the Daily Mirror native messaging host for Chrome.
# Usage: ./install-native-host.sh [chrome-extension-id]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MACOS_DIR="$(dirname "$SCRIPT_DIR")"
HOST_NAME="com.dailymirror.companion"
BUILD_DIR="$MACOS_DIR/.build/release"
HOST_BIN="$BUILD_DIR/DailyMirrorCompanion"
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="$MANIFEST_DIR/$HOST_NAME.json"

echo "Building Daily Mirror companion..."
cd "$MACOS_DIR"
swift build -c release

if [[ ! -f "$HOST_BIN" ]]; then
  echo "Build failed: $HOST_BIN not found" >&2
  exit 1
fi

EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Chrome extension ID not provided."
  echo "Find it at chrome://extensions (Developer mode) and re-run:"
  echo "  $0 YOUR_EXTENSION_ID"
  EXT_ID="EXTENSION_ID_PLACEHOLDER"
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_PATH" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Daily Mirror macOS companion — desktop app activity for Chrome extension",
  "path": "$HOST_BIN",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXT_ID}/"
  ],
  "args": ["--native-host"]
}
EOF

echo "Installed native messaging host:"
echo "  $MANIFEST_PATH"
echo "  Binary: $HOST_BIN"
echo ""
echo "Run the menu bar app (without --native-host) separately:"
echo "  open -a Terminal --args '$HOST_BIN'"
echo "Or: $HOST_BIN &"
echo ""
echo "Restart Chrome after installing."
