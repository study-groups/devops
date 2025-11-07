#!/usr/bin/env bash
# install.sh: Installation and upgrade functions

_tetra_self_install() {
    echo "Installing tetra..."
    echo ""

    # Log start
    self_log_try "install" "system"

    # Verify environment
    if [[ -z "$TETRA_SRC" ]]; then
        echo "Error: TETRA_SRC not set"
        self_log_fail "install" "system" '{"error":"TETRA_SRC not set"}'
        return 1
    fi

    if [[ ! -d "$TETRA_SRC" ]]; then
        echo "Error: TETRA_SRC directory does not exist: $TETRA_SRC"
        self_log_fail "install" "system" "{\"error\":\"TETRA_SRC not found\",\"path\":\"$TETRA_SRC\"}"
        return 1
    fi

    if [[ -z "$TETRA_DIR" ]]; then
        echo "Error: TETRA_DIR not set"
        self_log_fail "install" "system" '{"error":"TETRA_DIR not set"}'
        return 1
    fi

    # Check bootloader exists
    local bootloader="$TETRA_SRC/bash/bootloader.sh"
    if [[ ! -f "$bootloader" ]]; then
        echo "Error: bootloader.sh not found at $bootloader"
        self_log_fail "install" "system" "{\"error\":\"bootloader not found\",\"path\":\"$bootloader\"}"
        return 1
    fi

    # Ensure TETRA_DIR exists
    mkdir -p "$TETRA_DIR"

    # Check if tetra.sh exists in TETRA_DIR
    if [[ ! -f "$TETRA_DIR/tetra.sh" ]]; then
        echo "Warning: tetra.sh not found in TETRA_DIR"
        echo "You may need to manually create ~/tetra/tetra.sh that sources the bootloader"
        echo ""
    fi

    echo "✓ TETRA_SRC: $TETRA_SRC"
    echo "✓ TETRA_DIR: $TETRA_DIR"
    echo "✓ Bootloader: $bootloader"
    echo ""
    echo "Tetra installation verified successfully"
    echo "Run 'source ~/tetra/tetra.sh' to load tetra"

    # Log success
    self_log_success "install" "system" "{\"TETRA_SRC\":\"$TETRA_SRC\",\"TETRA_DIR\":\"$TETRA_DIR\"}"

    return 0
}

_tetra_self_upgrade() {
    echo "Upgrading tetra..."
    echo ""

    # Log start
    self_log_try "upgrade" "system"

    # Check if TETRA_SRC is a git repo
    if [[ -d "$TETRA_SRC/.git" ]]; then
        echo "Pulling latest changes from git..."
        echo "Repository: $TETRA_SRC"
        echo ""

        (cd "$TETRA_SRC" && git pull)

        if [[ $? -eq 0 ]]; then
            echo ""
            echo "✓ Git pull successful"
            echo ""
            echo "Reloading tetra..."
            source "$TETRA_SRC/bash/bootloader.sh"
            echo "✓ Tetra upgraded successfully"

            # Log success
            self_log_success "upgrade" "system" "{\"TETRA_SRC\":\"$TETRA_SRC\"}"
            return 0
        else
            echo "Error: Git pull failed"
            self_log_fail "upgrade" "system" '{"error":"git pull failed"}'
            return 1
        fi
    else
        echo "TETRA_SRC is not a git repository"
        echo "Manual update required"
        echo "Location: $TETRA_SRC"
        self_log_fail "upgrade" "system" "{\"error\":\"not a git repo\",\"path\":\"$TETRA_SRC\"}"
        return 1
    fi
}

# Export functions
export -f _tetra_self_install
export -f _tetra_self_upgrade
