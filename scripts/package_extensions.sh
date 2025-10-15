#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
DIST_DIR="$ROOT_DIR/dist"

mkdir -p "$DIST_DIR"

package() {
  local source_dir="$1"
  local target_name="$2"
  local target_path="$DIST_DIR/$target_name"

  if [ ! -d "$source_dir" ]; then
    echo "Source directory $source_dir not found" >&2
    exit 1
  fi

  rm -f "$target_path"
  (cd "$source_dir" && zip -r "$target_path" . >/dev/null)
  echo "Created $target_path"
}

package "$ROOT_DIR/chrome" "chrome.zip"
package "$ROOT_DIR/firefox" "firefox.xpi"
