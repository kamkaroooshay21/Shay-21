#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://192.168.60.103:8080/}"
OUTPUT_DIR="${2:-site}"

if ! command -v wget >/dev/null 2>&1; then
  echo "Error: wget is required but not installed. Install it first: apt-get install wget" >&2
  exit 1
fi

echo "Mirroring $URL into $OUTPUT_DIR ..."
mkdir -p "$OUTPUT_DIR"

wget --mirror \
  --convert-links \
  --adjust-extension \
  --page-requisites \
  --no-parent \
  --span-hosts \
  --domains=192.168.60.103 \
  --directory-prefix="$OUTPUT_DIR" \
  "$URL"

MIRRORED_PATH="$OUTPUT_DIR/192.168.60.103:8080"

if [ -d "$MIRRORED_PATH" ]; then
  echo
  echo "Mirror complete. Files are in: $MIRRORED_PATH"
  echo
  echo "Preview locally:"
  echo "  cd $MIRRORED_PATH && python3 -m http.server 8000"
  echo "  Then open http://localhost:8000"
  echo
  echo "To publish to GitHub Pages:"
  echo "  cp -r $MIRRORED_PATH/* ."
  echo "  git add ."
  echo "  git commit -m \"Add mirrored local dashboard\""
  echo "  git push origin main"
  echo "  Then enable Pages in GitHub settings"
else
  echo "Warning: mirror directory was not created as expected. Check the output above." >&2
  exit 1
fi
