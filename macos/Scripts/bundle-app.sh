#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MACOS_DIR="$(dirname "$SCRIPT_DIR")"
APP_NAME="DailyMirrorCompanion"
DISPLAY_NAME="Daily Mirror"
APP_DIR="$MACOS_DIR/$APP_NAME.app"
BUILD_BIN="$MACOS_DIR/.build/release/$APP_NAME"
VERSION="0.1.0"
BUNDLE_ID="com.dailymirror.companion"

echo "Building $APP_NAME..."
cd "$MACOS_DIR"
swift build -c release

if [[ ! -f "$BUILD_BIN" ]]; then
  echo "Build failed: $BUILD_BIN not found" >&2
  exit 1
fi

echo "Bundling $APP_DIR..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"
mkdir -p "$APP_DIR/Contents/Helpers"

cp "$BUILD_BIN" "$APP_DIR/Contents/MacOS/$APP_NAME"
chmod +x "$APP_DIR/Contents/MacOS/$APP_NAME"

cat > "$APP_DIR/Contents/Helpers/native-host" <<'EOF'
#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$DIR/../MacOS/DailyMirrorCompanion" --native-host
EOF
chmod +x "$APP_DIR/Contents/Helpers/native-host"

printf 'APPL????' > "$APP_DIR/Contents/PkgInfo"
"$SCRIPT_DIR/generate-app-icon.sh" "$APP_DIR/Contents/Resources/AppIcon.icns"

cat > "$APP_DIR/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$DISPLAY_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$DISPLAY_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
EOF

IDENTITY=""
while IFS= read -r line; do
  if [[ "$line" =~ \"(Apple\ Development|Developer\ ID\ Application): ]]; then
    IDENTITY="${line#*\"}"
    IDENTITY="${IDENTITY%\"}"
    break
  fi
done < <(security find-identity -v -p codesigning 2>/dev/null || true)

echo "Signing $APP_DIR..."
if [[ -n "$IDENTITY" ]]; then
  echo "  Using identity: $IDENTITY"
  codesign --force --deep --options runtime --sign "$IDENTITY" "$APP_DIR"
else
  echo "WARNING: No signing identity found; using ad-hoc sign." >&2
  codesign --force --deep --sign - "$APP_DIR"
fi

echo "Verifying signature..."
codesign --verify --deep --strict "$APP_DIR"

if spctl --assess --type execute "$APP_DIR" 2>/dev/null; then
  echo "Gatekeeper assessment: OK"
else
  echo "Note: Gatekeeper may still warn until the app is opened once from Finder or quarantine is cleared."
fi

echo "Done: $APP_DIR"
