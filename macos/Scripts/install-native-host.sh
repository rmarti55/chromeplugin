#!/bin/bash
# Install the Daily Mirror companion and Chrome native messaging host.
# Usage: ./install-native-host.sh [chrome-extension-id]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/install-companion.sh" "${1:-}"
