#!/bin/bash
# Generate AppIcon.icns for the companion bundle (stdlib Python3 only).
set -euo pipefail

OUTPUT="${1:?Usage: generate-app-icon.sh OUTPUT.icns}"
TMPDIR="$(mktemp -d)"
ICONSET="$TMPDIR/AppIcon.iconset"
mkdir -p "$ICONSET"
trap 'rm -rf "$TMPDIR"' EXIT

python3 - "$ICONSET" <<'PY'
import struct, sys, zlib, math
from pathlib import Path

iconset = Path(sys.argv[1])
iconset.mkdir(parents=True, exist_ok=True)

def write_png(path, size):
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    rows = []
    cx = cy = (size - 1) / 2.0
    outer = size * 0.42
    inner = size * 0.30

    for y in range(size):
        row = b"\x00"
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.hypot(dx, dy)
            if dist <= outer:
                t = min(1.0, max(0.0, (dist - inner) / max(outer - inner, 1)))
                r = int(34 + (18 - 34) * t)
                g = int(166 + (120 - 166) * t)
                b = int(176 + (130 - 176) * t)
                if dist <= inner * 0.08:
                    r, g, b = 245, 250, 252
                elif dist <= inner and dy <= 0 and abs(dx) <= inner * 0.12:
                    r, g, b = 245, 250, 252
                elif dist <= inner * 0.75 and dy > 0:
                    angle = math.atan2(dx, -dy)
                    if angle > math.pi / 6:
                        r, g, b = 245, 250, 252
                    elif angle < -math.pi / 3:
                        r, g, b = 245, 250, 252
                row += bytes([r, g, b])
            else:
                row += bytes([24, 36, 48])
        rows.append(row)

    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))

sizes = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

for size, name in sizes:
    write_png(iconset / name, size)
PY

iconutil -c icns "$ICONSET" -o "$OUTPUT"
echo "Generated $OUTPUT"
