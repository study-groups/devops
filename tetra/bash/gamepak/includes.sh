#!/usr/bin/env bash
# gamepak/includes.sh - Game package manager module initialization
#
# Provides git-like workflow for HTML5 games stored in S3:
#   gamepak clone <slug>    - Clone game from S3
#   gamepak status          - Show local vs remote diff
#   gamepak pull            - Sync S3 → local
#   gamepak push            - Sync local → S3
#   gamepak inspect         - Analyze index.html
#   gamepak doctor          - Fix issues, inject SDK

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: gamepak requires bash 5.2+" >&2
    return 1
fi

# Module paths
GAMEPAK_SRC="${TETRA_SRC}/bash/gamepak"
export GAMEPAK_SRC

# Default org for games (uses spaces context or TETRA_ORG)
_gamepak_get_org() {
    if declare -f _spaces_org &>/dev/null; then
        local ctx_org=$(_spaces_org 2>/dev/null)
        [[ -n "$ctx_org" ]] && echo "$ctx_org" && return
    fi
    echo "${TETRA_ORG:-pixeljam-arcade}"
}

# Default bucket
_gamepak_get_bucket() {
    if declare -f _spaces_bucket &>/dev/null; then
        local ctx_bucket=$(_spaces_bucket 2>/dev/null)
        [[ -n "$ctx_bucket" ]] && echo "$ctx_bucket" && return
    fi
    echo "pja-games"
}

# Load pja module for SDK paths
if [[ -f "$TETRA_SRC/bash/pja/includes.sh" ]]; then
    source "$TETRA_SRC/bash/pja/includes.sh"
fi

# SDK URL (CDN for production injection, local for development)
# Use PJA_SDK_DIST for local, GAMEPAK_SDK_URL for CDN deployment
GAMEPAK_SDK_URL="${GAMEPAK_SDK_URL:-https://pja-games.sfo3.digitaloceanspaces.com/sdk/pja-sdk.iife.js}"
export GAMEPAK_SDK_URL

# Load dependencies
if ! declare -f _spaces_resolve &>/dev/null; then
    if [[ -f "$TETRA_SRC/bash/spaces/spaces.sh" ]]; then
        source "$TETRA_SRC/bash/spaces/spaces.sh"
    fi
fi

# Load core modules
[[ -f "$GAMEPAK_SRC/core/clone.sh" ]] && source "$GAMEPAK_SRC/core/clone.sh"
[[ -f "$GAMEPAK_SRC/core/sync.sh" ]] && source "$GAMEPAK_SRC/core/sync.sh"
[[ -f "$GAMEPAK_SRC/core/inspect.sh" ]] && source "$GAMEPAK_SRC/core/inspect.sh"
[[ -f "$GAMEPAK_SRC/core/doctor.sh" ]] && source "$GAMEPAK_SRC/core/doctor.sh"

# Load main dispatcher
[[ -f "$GAMEPAK_SRC/gamepak.sh" ]] && source "$GAMEPAK_SRC/gamepak.sh"

# Exports
export -f _gamepak_get_org _gamepak_get_bucket

echo "Gamepak module loaded" >&2
