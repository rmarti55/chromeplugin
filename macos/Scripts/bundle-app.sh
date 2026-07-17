#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MACOS_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="DailyMirrorCompanion"
APP_DIR="$MACOS_DIR/$APP_NAME.app"
BUILD_BIN="$MACOS_DIR/.build/release/$APP_NAME"

echo "Building $APP_NAME..."
cd "$MACOS_DIR"
swift build -c release

if [[ ! -f "$BUILD_BIN" ]]; then
  echo "Build failed: $BUILD_BIN not found" >&2
  exit 1
fi

echo "Bundling $APP_DIR..."
mkdir -p "$APP_DIR/Contents/MacOS"
cp "$BUILD_BIN" "$APP_DIR/Contents/MacOS/$APP_NAME"
chmod +x "$APP_DIR/Contents/MacOS/$APP_NAME"

cat > "$APP_DIR/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>DailyMirrorCompanion</string>
  <key>CFBundleIdentifier</key>
  <string>com.dailymirror.companion</string>
  <key>CFBundleName</key>
  <string>Daily Mirror</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
EOF

echo "Done: $APP_DIR"
