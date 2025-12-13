#!/usr/bin/env bash

# TSM Platform Abstraction
# Provides cross-platform wrappers for tools that differ between Linux and macOS
# Contains all platform-specific detection and path resolution

# === PLATFORM DETECTION ===

# Detect platform once at load time
TSM_PLATFORM=""
TSM_PLATFORM_HOMEBREW_PREFIX=""

_tsm_detect_platform() {
    case "$OSTYPE" in
        darwin*)
            TSM_PLATFORM="macos"
            # Detect Homebrew prefix (handles both Intel and Apple Silicon)
            if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
                TSM_PLATFORM_HOMEBREW_PREFIX="$HOMEBREW_PREFIX"
            elif [[ -d "/opt/homebrew" ]]; then
                TSM_PLATFORM_HOMEBREW_PREFIX="/opt/homebrew"
            elif [[ -d "/usr/local/Homebrew" ]]; then
                TSM_PLATFORM_HOMEBREW_PREFIX="/usr/local"
            fi
            ;;
        linux*)
            TSM_PLATFORM="linux"
            ;;
        *)
            TSM_PLATFORM="unknown"
            ;;
    esac
}

# Run detection at source time
_tsm_detect_platform

# === TOOL PATH RESOLUTION ===

# Cached tool paths (set on first lookup)
declare -g _TSM_FLOCK_PATH=""
declare -g _TSM_SETSID_PATH=""

# Find flock command
# Returns: path to flock or empty string if not available
tsm_get_flock() {
    # Return cached value if already resolved
    if [[ -n "$_TSM_FLOCK_PATH" ]]; then
        echo "$_TSM_FLOCK_PATH"
        return 0
    fi

    # Check PATH first
    if command -v flock >/dev/null 2>&1; then
        _TSM_FLOCK_PATH=$(command -v flock)
        echo "$_TSM_FLOCK_PATH"
        return 0
    fi

    # macOS: check Homebrew keg-only location
    if [[ "$TSM_PLATFORM" == "macos" && -n "$TSM_PLATFORM_HOMEBREW_PREFIX" ]]; then
        local keg_path="$TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux/bin/flock"
        if [[ -x "$keg_path" ]]; then
            _TSM_FLOCK_PATH="$keg_path"
            echo "$_TSM_FLOCK_PATH"
            return 0
        fi
    fi

    # Not found
    return 1
}

# Find setsid command
# Returns: path to setsid or empty string if not available
tsm_get_setsid() {
    # Return cached value if already resolved
    if [[ -n "$_TSM_SETSID_PATH" ]]; then
        echo "$_TSM_SETSID_PATH"
        return 0
    fi

    # Linux: setsid is standard
    if [[ "$TSM_PLATFORM" == "linux" ]]; then
        if command -v setsid >/dev/null 2>&1; then
            _TSM_SETSID_PATH=$(command -v setsid)
            echo "$_TSM_SETSID_PATH"
            return 0
        fi
        return 1
    fi

    # macOS: check PATH first
    if command -v setsid >/dev/null 2>&1; then
        _TSM_SETSID_PATH=$(command -v setsid)
        echo "$_TSM_SETSID_PATH"
        return 0
    fi

    # macOS: check Homebrew keg-only location
    if [[ "$TSM_PLATFORM" == "macos" && -n "$TSM_PLATFORM_HOMEBREW_PREFIX" ]]; then
        local keg_path="$TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux/bin/setsid"
        if [[ -x "$keg_path" ]]; then
            _TSM_SETSID_PATH="$keg_path"
            echo "$_TSM_SETSID_PATH"
            return 0
        fi
    fi

    # Not found
    return 1
}

# === CONVENIENCE WRAPPERS ===

# Check if flock is available
tsm_has_flock() {
    [[ -n "$(tsm_get_flock)" ]]
}

# Check if setsid is available
tsm_has_setsid() {
    [[ -n "$(tsm_get_setsid)" ]]
}

# Check if util-linux tools are available (both flock and setsid)
tsm_has_util_linux() {
    tsm_has_flock && tsm_has_setsid
}

# === DOCTOR INTEGRATION ===

# Check platform dependencies for doctor command
# Returns diagnostic info as structured output
# Usage: tsm_check_platform_deps [--quiet]
tsm_check_platform_deps() {
    local quiet="${1:-}"
    local status="ok"
    local message=""
    local suggestion=""

    if [[ "$TSM_PLATFORM" == "linux" ]]; then
        # Linux: util-linux is standard, just verify it exists
        if tsm_has_flock && tsm_has_setsid; then
            message="util-linux available (flock, setsid)"
        else
            status="error"
            message="util-linux tools missing (flock, setsid)"
            suggestion="Install with: sudo apt install util-linux"
        fi
    elif [[ "$TSM_PLATFORM" == "macos" ]]; then
        local flock_path=$(tsm_get_flock)
        local setsid_path=$(tsm_get_setsid)

        if [[ -n "$flock_path" && -n "$setsid_path" ]]; then
            # Check if in PATH or keg-only
            if command -v flock >/dev/null 2>&1 && command -v setsid >/dev/null 2>&1; then
                message="util-linux available (flock, setsid)"
            else
                status="info"
                message="util-linux installed (keg-only at $TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux)"
                suggestion="To add to PATH: echo 'export PATH=\"$TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux/bin:\$PATH\"' >> ~/.bash_profile"
            fi
        elif [[ -d "$TSM_PLATFORM_HOMEBREW_PREFIX/opt/util-linux" ]]; then
            status="warn"
            message="util-linux installed but missing flock/setsid binaries"
            suggestion="Try reinstalling: brew reinstall util-linux"
        else
            status="warn"
            message="util-linux not installed (provides flock, setsid for better process management)"
            suggestion="Install with: brew install util-linux"
        fi
    else
        status="warn"
        message="Unknown platform: $OSTYPE"
    fi

    # Output based on quiet flag
    if [[ "$quiet" != "--quiet" ]]; then
        case "$status" in
            ok)
                echo "ok:$message"
                ;;
            info)
                echo "info:$message"
                [[ -n "$suggestion" ]] && echo "suggestion:$suggestion"
                ;;
            warn)
                echo "warn:$message"
                [[ -n "$suggestion" ]] && echo "suggestion:$suggestion"
                ;;
            error)
                echo "error:$message"
                [[ -n "$suggestion" ]] && echo "suggestion:$suggestion"
                ;;
        esac
    fi

    # Return appropriate exit code
    case "$status" in
        ok|info) return 0 ;;
        warn) return 0 ;;  # Warnings don't fail
        error) return 1 ;;
    esac
}

# === EXPORTS ===

export TSM_PLATFORM TSM_PLATFORM_HOMEBREW_PREFIX
export -f tsm_get_flock tsm_get_setsid
export -f tsm_has_flock tsm_has_setsid tsm_has_util_linux
export -f tsm_check_platform_deps
