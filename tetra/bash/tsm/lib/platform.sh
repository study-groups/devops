#!/usr/bin/env bash
# TSM Platform - cross-platform tool detection (macOS/Linux)

# Platform globals
TSM_PLATFORM=""
TSM_PLATFORM_HOMEBREW_PREFIX=""

_tsm_detect_platform() {
    case "$OSTYPE" in
        darwin*)
            TSM_PLATFORM="macos"
            if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
                TSM_PLATFORM_HOMEBREW_PREFIX="$HOMEBREW_PREFIX"
            elif [[ -d "/opt/homebrew" ]]; then
                TSM_PLATFORM_HOMEBREW_PREFIX="/opt/homebrew"
            elif [[ -d "/usr/local/Homebrew" ]]; then
                TSM_PLATFORM_HOMEBREW_PREFIX="/usr/local"
            fi
            ;;
        linux*)  TSM_PLATFORM="linux" ;;
        *)       TSM_PLATFORM="unknown" ;;
    esac
}

_tsm_detect_platform

# Tool path cache
declare -g _TSM_FLOCK_PATH=""
declare -g _TSM_SETSID_PATH=""

# Find flock - returns path or empty
tsm_get_flock() {
    [[ -n "$_TSM_FLOCK_PATH" ]] && { echo "$_TSM_FLOCK_PATH"; return 0; }

    if command -v flock >/dev/null 2>&1; then
        _TSM_FLOCK_PATH=$(command -v flock)
        echo "$_TSM_FLOCK_PATH"
        return 0
    fi

    if [[ "$TSM_PLATFORM" == "macos" && -n "$TSM_PLATFORM_HOMEBREW_PREFIX" ]]; then
        local keg="$TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux/bin/flock"
        [[ -x "$keg" ]] && { _TSM_FLOCK_PATH="$keg"; echo "$keg"; return 0; }
    fi
    return 1
}

# Find setsid - returns path or empty
tsm_get_setsid() {
    [[ -n "$_TSM_SETSID_PATH" ]] && { echo "$_TSM_SETSID_PATH"; return 0; }

    if command -v setsid >/dev/null 2>&1; then
        _TSM_SETSID_PATH=$(command -v setsid)
        echo "$_TSM_SETSID_PATH"
        return 0
    fi

    if [[ "$TSM_PLATFORM" == "macos" && -n "$TSM_PLATFORM_HOMEBREW_PREFIX" ]]; then
        local keg="$TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux/bin/setsid"
        [[ -x "$keg" ]] && { _TSM_SETSID_PATH="$keg"; echo "$keg"; return 0; }
    fi
    return 1
}

tsm_has_flock() { [[ -n "$(tsm_get_flock)" ]]; }
tsm_has_setsid() { [[ -n "$(tsm_get_setsid)" ]]; }

export TSM_PLATFORM TSM_PLATFORM_HOMEBREW_PREFIX
export -f tsm_get_flock tsm_get_setsid tsm_has_flock tsm_has_setsid
