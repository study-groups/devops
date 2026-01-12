#!/usr/bin/env bash
# tdocs v2 - Minimal document management with mount points and numbered lists
#
# Core concepts:
#   mount  - directories to scan for docs
#   tls    - numbered list with slot memory
#   view   - access docs by slot:index
#   tag    - free-form labels
#
# Usage:
#   tdocs mount add ~/path          # add mount point
#   tdocs ls                         # list all docs → slot 0
#   tdocs view 4                     # view 4th doc from current list
#   tdocs view 1:3                   # view 3rd doc from previous list
#   tdocs tag 4 sdk api              # tag doc with labels

[[ "${BASH_VERSINFO[0]}" -lt 5 || ("${BASH_VERSINFO[0]}" -eq 5 && "${BASH_VERSINFO[1]}" -lt 2) ]] && {
    echo "[tdocs] ERROR: Requires bash 5.2+" >&2
    return 1
}

# Paths
TDOCS_SRC="${TETRA_SRC:?}/bash/tdocs"
TDOCS_DIR="${TETRA_DIR:?}/tdocs"
TDOCS_MOUNTS="${TDOCS_DIR}/mounts.json"
TDOCS_SLOTS="${TDOCS_DIR}/slots"
TDOCS_TAGS="${TDOCS_DIR}/tags.json"

# Slot configuration
TDOCS_SLOT_COUNT=5  # Keep last 5 lists in memory

# Ensure directories exist
mkdir -p "$TDOCS_DIR" "$TDOCS_SLOTS"

# Initialize mounts file if missing
[[ -f "$TDOCS_MOUNTS" ]] || echo '{"mounts":[]}' > "$TDOCS_MOUNTS"
[[ -f "$TDOCS_TAGS" ]] || echo '{}' > "$TDOCS_TAGS"

# Load core modules
source "$TDOCS_SRC/core/mount.sh"
source "$TDOCS_SRC/core/tls.sh"
source "$TDOCS_SRC/core/view.sh"
source "$TDOCS_SRC/core/tag.sh"
source "$TDOCS_SRC/lib/hash.sh"

# Load main dispatcher
source "$TDOCS_SRC/tdocs.sh"

export TDOCS_SRC TDOCS_DIR TDOCS_MOUNTS TDOCS_SLOTS TDOCS_TAGS TDOCS_SLOT_COUNT
export -f tdocs
