#!/bin/bash
# Legacy wrapper — prefer ~/Applications/Daily Mirror.app/Contents/Helpers/native-host
set -euo pipefail
INSTALLED="$HOME/Applications/Daily Mirror.app/Contents/Helpers/native-host"
if [[ -x "$INSTALLED" ]]; then
  exec "$INSTALLED"
fi
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/../DailyMirrorCompanion.app/Contents/MacOS/DailyMirrorCompanion" --native-host
