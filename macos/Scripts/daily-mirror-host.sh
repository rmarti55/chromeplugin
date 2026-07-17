#!/bin/bash
# Chrome native messaging host — always stdio mode, never LaunchServices GUI.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/../DailyMirrorCompanion.app/Contents/MacOS/DailyMirrorCompanion" --native-host
