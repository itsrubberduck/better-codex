#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"

mkdir -p "${DIST_DIR}"

for EXT in chrome firefox; do
  SRC_DIR="${ROOT_DIR}/${EXT}"
  if [[ ! -d "${SRC_DIR}" ]]; then
    echo "Skipping ${EXT}: directory ${SRC_DIR} not found" >&2
    continue
  fi

  ARCHIVE_NAME="${EXT}.zip"
  OUTPUT_PATH="${DIST_DIR}/${ARCHIVE_NAME}"

  echo "Packaging ${EXT} extension -> ${OUTPUT_PATH}"
  rm -f "${OUTPUT_PATH}"
  (cd "${SRC_DIR}" && zip -rq "${OUTPUT_PATH}" .)

done

echo "All done! Archives are in ${DIST_DIR}" 
