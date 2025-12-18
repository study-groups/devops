#!/usr/bin/env bash

# doctor.sh - System diagnostics for Pulsar game engine
# Checks engine status, dependencies, terminal capabilities, and input devices

# Ensure input_detect.sh is sourced
if ! declare -f input_detect_all >/dev/null 2>&1; then
    if [[ -f "${GAME_SRC}/core/input_detect.sh" ]]; then
        source "${GAME_SRC}/core/input_detect.sh"
    fi
fi

# ============================================================================
# DIAGNOSTIC FUNCTIONS
# ============================================================================

# Check if Pulsar engine is built
doctor_check_engine() {
    echo "=== Pulsar Engine ==="

    local engine_bin="${GAME_SRC}/engine/bin/pulsar"

    if [[ -x "$engine_bin" ]]; then
        echo "  Status:     ✓ Built"
        echo "  Path:       $engine_bin"

        # Get file size
        local size
        if command -v stat >/dev/null 2>&1; then
            size=$(stat -f%z "$engine_bin" 2>/dev/null || stat -c%s "$engine_bin" 2>/dev/null || echo "?")
            echo "  Size:       ${size} bytes"
        fi

        # Test if it runs
        if echo "QUIT" | "$engine_bin" >/dev/null 2>&1; then
            echo "  Test:       ✓ OK"
        else
            echo "  Test:       ✗ FAILED"
        fi
    else
        echo "  Status:     ✗ Not built"
        echo "  Path:       $engine_bin"
        echo "  Fix:        cd $GAME_SRC/engine && make"
    fi

    echo ""
}

# Check dependencies
doctor_check_dependencies() {
    echo "=== Dependencies ==="

    local deps=(
        "cc:C compiler"
        "make:Build system"
        "tput:Terminal control"
        "stty:Terminal settings"
    )

    for dep_info in "${deps[@]}"; do
        local cmd="${dep_info%%:*}"
        local desc="${dep_info##*:}"

        if command -v "$cmd" >/dev/null 2>&1; then
            local version
            case "$cmd" in
                cc)
                    version=$($cmd --version 2>&1 | head -1)
                    ;;
                make)
                    version=$($cmd --version 2>&1 | head -1)
                    ;;
                *)
                    version="available"
                    ;;
            esac
            echo "  ✓ $desc ($cmd): $version"
        else
            echo "  ✗ $desc ($cmd): NOT FOUND"
        fi
    done

    echo ""
}

# Check terminal capabilities
doctor_check_terminal() {
    echo "=== Terminal ==="

    # Run terminal detection
    input_detect_terminal

    echo "  Size:       ${TERMINAL_COLS}x${TERMINAL_ROWS}"
    echo "  Colors:     ${TERMINAL_COLORS}"
    echo "  UTF-8:      $([ "${TERMINAL_UTF8}" = "1" ] && echo "✓ Yes" || echo "✗ No")"
    echo "  Type:       ${TERMINAL_TYPE}"

    # Check for Braille support (needed for microgrid rendering)
    if [[ "${TERMINAL_UTF8}" == "1" ]]; then
        echo "  Braille:    ✓ Supported (UTF-8 enabled)"
    else
        echo "  Braille:    ✗ Not supported (UTF-8 required)"
    fi

    echo ""
}

# Check gamepad
doctor_check_gamepad() {
    echo "=== Gamepad ==="

    # Run gamepad detection
    input_detect_gamepad

    if [[ "${GAMEPAD_DETECTED}" == "1" ]]; then
        echo "  Status:     ✓ Detected"
        echo "  Vendor ID:  ${GAMEPAD_VENDOR_ID}"
        echo "  Product ID: ${GAMEPAD_PRODUCT_ID}"

        # Note about macOS
        if [[ "$(uname -s)" == "Darwin" ]]; then
            echo "  Platform:   macOS"
            echo "  Note:       macOS gamepad input requires IOKit/Game Controller framework"
            echo "              Full gamepad support coming soon"
        fi
    else
        echo "  Status:     ✗ Not detected"
        echo "  Note:       Keyboard controls will work"
    fi

    echo ""
}

# Check Tetra modules
doctor_check_tetra_modules() {
    echo "=== Tetra Modules ==="

    local modules=(
        "color:Color system"
        "tds:Display system"
        "tcurses:Input handling"
        "logs:Logging system"
    )

    for mod_info in "${modules[@]}"; do
        local mod="${mod_info%%:*}"
        local desc="${mod_info##*:}"
        local mod_file="$TETRA_SRC/bash/$mod/${mod}.sh"

        if [[ -f "$mod_file" ]]; then
            echo "  ✓ $desc ($mod)"
        else
            echo "  ✗ $desc ($mod) - NOT FOUND"
        fi
    done

    echo ""
}

# Check game module status
doctor_check_game_module() {
    echo "=== Game Module ==="

    echo "  GAME_SRC:            $GAME_SRC"
    echo "  GAME_VERSION:        ${GAME_VERSION:-not set}"
    echo "  PULSAR_AVAILABLE:    ${GAME_PULSAR_AVAILABLE:-not set}"

    # Count entities
    local entity_count=${#GAME_ENTITIES[@]}
    echo "  Active entities:     $entity_count"

    # Check core files
    local core_files=(
        "core/pulsar.sh"
        "core/game_loop_pulsar.sh"
        "animation/pulsar_3d.sh"
        "demos/quadrapole_3d.sh"
    )

    local missing=0
    for file in "${core_files[@]}"; do
        if [[ ! -f "$GAME_SRC/$file" ]]; then
            echo "  ✗ Missing: $file"
            ((missing++))
        fi
    done

    if [[ $missing -eq 0 ]]; then
        echo "  Files:               ✓ All core files present"
    else
        echo "  Files:               ✗ $missing missing"
    fi

    echo ""
}

# Check configuration files
doctor_check_configs() {
    echo "=== Configuration ==="

    local config_dir="$GAME_SRC/config"
    local configs=(
        "game.toml"
        "pulsars.toml"
        "controls.toml"
        "physics.toml"
        "help.toml"
    )

    for config in "${configs[@]}"; do
        if [[ -f "$config_dir/$config" ]]; then
            local size
            size=$(wc -l < "$config_dir/$config" 2>/dev/null || echo "?")
            echo "  ✓ $config ($size lines)"
        else
            echo "  ✗ $config - NOT FOUND"
        fi
    done

    echo ""
}

# ============================================================================
# MAIN DOCTOR FUNCTION
# ============================================================================

game_doctor() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         Pulsar Game Engine - System Diagnostics          ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    doctor_check_engine
    doctor_check_dependencies
    doctor_check_terminal
    doctor_check_gamepad
    doctor_check_tetra_modules
    doctor_check_game_module
    doctor_check_configs

    echo "=== Summary ==="

    # Overall health check
    local issues=0

    # Check critical items
    if [[ ! -x "${GAME_SRC}/engine/bin/pulsar" ]]; then
        echo "  ✗ Engine not built"
        ((issues++))
    fi

    if [[ "${TERMINAL_UTF8}" != "1" ]]; then
        echo "  ⚠ UTF-8 not enabled (Braille rendering may not work)"
        ((issues++))
    fi

    if [[ "${TERMINAL_COLORS}" -lt 8 ]]; then
        echo "  ⚠ Limited color support"
        ((issues++))
    fi

    if [[ $issues -eq 0 ]]; then
        echo "  ✓ All systems operational"
        echo ""
        echo "Ready to run: game quadrapole-gfx"
    else
        echo "  Found $issues issue(s)"
        echo ""
        echo "Run 'game help' for more information"
    fi

    echo ""
}

# Export doctor function
export -f game_doctor
export -f doctor_check_engine
export -f doctor_check_dependencies
export -f doctor_check_terminal
export -f doctor_check_gamepad
export -f doctor_check_tetra_modules
export -f doctor_check_game_module
export -f doctor_check_configs
