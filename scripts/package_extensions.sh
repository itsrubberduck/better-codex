#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1090
if [ -f "$HOME/.bashrc" ]; then
  set +u
  #source "$HOME/.bashrc"
  set -u
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
DIST_DIR="$ROOT_DIR/dist"
SIGNED_WORK_DIR="$DIST_DIR/.signed"

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

sign_firefox() {
  local source_dir="$1"
  local unsigned_path="$2"

  if ! command -v web-ext >/dev/null 2>&1; then
    echo "Skipping Firefox signing: web-ext CLI not found. Install it with 'npm install -g web-ext'."
    return
  fi

  if { [ -n "${AMO_JWT_ISSUER:-}" ] && [ -n "${AMO_JWT_SECRET:-}" ]; } || \
     { [ -n "${WEB_EXT_API_KEY:-}" ] && [ -n "${WEB_EXT_API_SECRET:-}" ]; }; then
    :
  else
    cat <<'EOM'
Skipping Firefox signing: credentials not found.
Set AMO_JWT_ISSUER/AMO_JWT_SECRET or WEB_EXT_API_KEY/WEB_EXT_API_SECRET in ~/.bashrc.
EOM
    return
  fi

  rm -rf "$SIGNED_WORK_DIR"
  mkdir -p "$SIGNED_WORK_DIR"

  local sign_args=(
    sign
    --source-dir "$source_dir"
    --artifacts-dir "$SIGNED_WORK_DIR"
    --api-secret "$AMO_JWT_SECRET"
    --api-key "$AMO_JWT_ISSUER"
    --channel "listed"
      --amo-metadata ../firefox/amo-metadata.json
  )

  if [ -n "${WEB_EXT_CHANNEL:-}" ]; then
    sign_args+=(--channel "$WEB_EXT_CHANNEL")
  fi

  echo "Signing Firefox add-on via web-ext…"
  if ! web-ext "${sign_args[@]}"; then
    echo "Firefox signing failed." >&2
    return
  fi

  shopt -s nullglob
  local artifacts=("$SIGNED_WORK_DIR"/*.xpi "$SIGNED_WORK_DIR"/*.zip)
  shopt -u nullglob

  if [ ${#artifacts[@]} -eq 0 ]; then
    echo "Firefox signing completed but no artifact produced." >&2
    return
  fi

  local artifact="${artifacts[0]}"
  for candidate in "${artifacts[@]}"; do
    if [ "$candidate" -nt "$artifact" ]; then
      artifact="$candidate"
    fi
  done

  local signed_target="$DIST_DIR/firefox-signed.xpi"
  mv "$artifact" "$signed_target"
  rm -rf "$SIGNED_WORK_DIR"
  echo "Created $signed_target"

  if [ -f "$unsigned_path" ]; then
    echo "Unsigned build remains available at $unsigned_path"
  fi
}

package "$ROOT_DIR/chrome" "chrome.zip"
package "$ROOT_DIR/firefox" "firefox.xpi"

sign_firefox "$ROOT_DIR/firefox" "$DIST_DIR/firefox.xpi"
