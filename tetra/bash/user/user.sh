#!/usr/bin/env bash
# user.sh - Cross-platform user management (macOS + Linux)
#
# For testing tetra installations with fresh users.
# Supports creating users, setting up SSH keys, and bootstrapping tetra.
#
# Usage: user <command> [args]

USER_SRC="${TETRA_SRC}/bash/user"

# =============================================================================
# PLATFORM DETECTION
# =============================================================================

_user_platform() {
    case "$OSTYPE" in
        darwin*) echo "macos" ;;
        linux*)  echo "linux" ;;
        *)       echo "unknown" ;;
    esac
}

_user_home_base() {
    case "$(_user_platform)" in
        macos) echo "/Users" ;;
        linux) echo "/home" ;;
    esac
}

# =============================================================================
# HELP
# =============================================================================

_user_help() {
    cat <<'EOF'
user - Cross-platform user management

COMMANDS
  user create <name> [--admin]   Create user with SSH keys
  user delete <name> [--backup]  Delete user (--backup saves home dir)
  user list                      List non-system users
  user status <name>             Show user info, disk, SSH keys
  user exists <name>             Check if user exists (exit 0/1)

TETRA BOOTSTRAP
  user setup-tetra <name>        Clone tetra repo and run setup as user
  user remove-tetra <name>       Remove tetra from user (interactive)
  user test-install <name>       Create user + setup tetra + verify

OPTIONS
  --admin                        Make user an administrator (create)
  --backup                       Backup home directory before delete
  --no-ssh                       Skip SSH key generation (create)

PLATFORMS
  macOS: uses sysadminctl/dscl
  Linux: uses useradd/userdel

EXAMPLES
  user create devtest            Create standard user 'devtest'
  user create devtest --admin    Create admin user
  user status devtest            Show user details
  user setup-tetra devtest       Bootstrap tetra for user
  user delete devtest --backup   Delete with backup
EOF
}

# =============================================================================
# CREATE
# =============================================================================

_user_create() {
    local username=""
    local admin=false
    local no_ssh=false

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --admin)  admin=true; shift ;;
            --no-ssh) no_ssh=true; shift ;;
            -*)       echo "Unknown option: $1" >&2; return 1 ;;
            *)        username="$1"; shift ;;
        esac
    done

    if [[ -z "$username" ]]; then
        echo "Usage: user create <username> [--admin] [--no-ssh]" >&2
        return 1
    fi

    # Check if user already exists
    if id "$username" &>/dev/null; then
        echo "User '$username' already exists" >&2
        return 1
    fi

    local platform=$(_user_platform)
    local home_dir="$(_user_home_base)/$username"

    echo "Creating user '$username' on $platform..."

    case "$platform" in
        macos)
            _user_create_macos "$username" "$admin"
            ;;
        linux)
            _user_create_linux "$username" "$admin"
            ;;
        *)
            echo "Unsupported platform: $platform" >&2
            return 1
            ;;
    esac

    local rc=$?
    [[ $rc -ne 0 ]] && return $rc

    # Setup SSH keys
    if [[ "$no_ssh" != "true" ]]; then
        _user_setup_ssh "$username"
    fi

    echo "User '$username' created successfully"
    _user_status "$username"
}

_user_create_macos() {
    local username="$1"
    local admin="$2"
    local home_dir="/Users/$username"

    local admin_flag=""
    [[ "$admin" == "true" ]] && admin_flag="-admin"

    # Generate a random password (user will use SSH keys)
    local temp_pass=$(openssl rand -base64 12)

    sudo sysadminctl -addUser "$username" \
        -fullName "$username" \
        -password "$temp_pass" \
        -home "$home_dir" \
        $admin_flag

    # sysadminctl assigns but doesn't create home directory - create it
    if [[ ! -d "$home_dir" ]]; then
        sudo mkdir -p "$home_dir"
        sudo chown "$username:staff" "$home_dir"
        sudo chmod 755 "$home_dir"
    fi

    # Set shell to bash (sysadminctl defaults may vary)
    sudo dscl . -create "/Users/$username" UserShell /bin/bash
}

_user_create_linux() {
    local username="$1"
    local admin="$2"

    # Create user with home directory and bash shell
    sudo useradd -m -s /bin/bash "$username"

    # Disable password login (SSH key only)
    sudo passwd -d "$username" 2>/dev/null || true

    # Add to sudo/wheel group if admin
    if [[ "$admin" == "true" ]]; then
        if getent group sudo &>/dev/null; then
            sudo usermod -aG sudo "$username"
        elif getent group wheel &>/dev/null; then
            sudo usermod -aG wheel "$username"
        fi
    fi
}

_user_setup_ssh() {
    local username="$1"
    local home_dir="$(_user_home_base)/$username"
    local ssh_dir="$home_dir/.ssh"

    echo "  Setting up SSH keys..."

    # Create .ssh directory
    sudo mkdir -p "$ssh_dir"
    sudo chmod 700 "$ssh_dir"
    sudo chown "$username" "$ssh_dir"

    # Generate SSH key pair
    sudo -u "$username" ssh-keygen -t ed25519 \
        -f "$ssh_dir/id_ed25519" \
        -N "" \
        -C "${username}@$(hostname)" 2>/dev/null

    # Setup authorized_keys
    sudo touch "$ssh_dir/authorized_keys"
    sudo chmod 600 "$ssh_dir/authorized_keys"
    sudo chown "$username" "$ssh_dir/authorized_keys"

    # Add public key to authorized_keys (for local testing)
    sudo cat "$ssh_dir/id_ed25519.pub" | sudo tee -a "$ssh_dir/authorized_keys" > /dev/null

    # Fix ownership of all files
    sudo chown -R "$username" "$ssh_dir"
}

# =============================================================================
# DELETE
# =============================================================================

_user_delete() {
    local username=""
    local backup=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --backup) backup=true; shift ;;
            -*)       echo "Unknown option: $1" >&2; return 1 ;;
            *)        username="$1"; shift ;;
        esac
    done

    if [[ -z "$username" ]]; then
        echo "Usage: user delete <username> [--backup]" >&2
        return 1
    fi

    # Check if user exists
    if ! id "$username" &>/dev/null; then
        echo "User '$username' does not exist" >&2
        return 1
    fi

    # Safety check - protected users (never delete these)
    local protected="root mricos"
    for p in $protected; do
        if [[ "$username" == "$p" ]]; then
            echo "Cannot delete protected user '$username'" >&2
            return 1
        fi
    done

    # Don't delete the user running the command
    if [[ "$username" == "$(whoami)" ]]; then
        echo "Cannot delete current user" >&2
        return 1
    fi

    local platform=$(_user_platform)
    local home_dir="$(_user_home_base)/$username"

    # Backup if requested
    if [[ "$backup" == "true" && -d "$home_dir" ]]; then
        local backup_path="${home_dir}_backup_$(date +%Y%m%d_%H%M%S)"
        echo "Backing up to $backup_path..."
        sudo cp -r "$home_dir" "$backup_path"
    fi

    echo "Deleting user '$username'..."

    case "$platform" in
        macos)
            sudo sysadminctl -deleteUser "$username"
            ;;
        linux)
            sudo userdel -r "$username"
            ;;
        *)
            echo "Unsupported platform: $platform" >&2
            return 1
            ;;
    esac

    echo "User '$username' deleted"
}

# =============================================================================
# LIST
# =============================================================================

_user_list() {
    local platform=$(_user_platform)

    echo "Users ($platform):"
    echo "---"

    case "$platform" in
        macos)
            # Filter out system users (UID < 500 or starting with _)
            dscl . list /Users UniqueID | while read -r name uid; do
                [[ "$name" == _* ]] && continue
                [[ "$uid" -lt 500 ]] && continue
                [[ "$name" == "nobody" ]] && continue
                printf "  %-20s (uid: %s)\n" "$name" "$uid"
            done
            ;;
        linux)
            # Filter normal users (UID >= 1000, or 500 on older systems)
            getent passwd | while IFS=: read -r name _ uid _ _ home shell; do
                [[ "$uid" -lt 1000 ]] && continue
                [[ "$uid" -eq 65534 ]] && continue  # nobody
                printf "  %-20s (uid: %s) %s\n" "$name" "$uid" "$home"
            done
            ;;
    esac
}

# =============================================================================
# STATUS
# =============================================================================

_user_status() {
    local username="${1:-}"

    if [[ -z "$username" ]]; then
        echo "Usage: user status <username>" >&2
        return 1
    fi

    if ! id "$username" &>/dev/null; then
        echo "User '$username' does not exist" >&2
        return 1
    fi

    local platform=$(_user_platform)
    local home_dir="$(_user_home_base)/$username"

    echo "User: $username"
    echo "Platform: $platform"
    echo "Home: $home_dir"
    echo "UID: $(id -u "$username")"
    echo "Groups: $(id -Gn "$username" | tr ' ' ', ')"
    echo ""

    # Disk usage
    if [[ -d "$home_dir" ]]; then
        echo "Disk usage:"
        du -sh "$home_dir" 2>/dev/null | sed 's/^/  /'
    fi
    echo ""

    # SSH keys
    local ssh_dir="$home_dir/.ssh"
    echo "SSH keys:"
    if [[ -d "$ssh_dir" ]]; then
        ls -la "$ssh_dir"/*.pub 2>/dev/null | while read -r line; do
            echo "  $line"
        done
        if [[ -f "$ssh_dir/authorized_keys" ]]; then
            local key_count=$(wc -l < "$ssh_dir/authorized_keys" | tr -d ' ')
            echo "  authorized_keys: $key_count key(s)"
        fi
    else
        echo "  (no .ssh directory)"
    fi
    echo ""

    # Login status
    echo "Login status:"
    if who | grep -q "^$username "; then
        echo "  Currently logged in"
    else
        echo "  Not logged in"
    fi

    # Last login
    case "$platform" in
        macos)
            last -1 "$username" 2>/dev/null | head -1 | sed 's/^/  Last: /'
            ;;
        linux)
            lastlog -u "$username" 2>/dev/null | tail -1 | sed 's/^/  /'
            ;;
    esac
}

# =============================================================================
# EXISTS
# =============================================================================

_user_exists() {
    local username="${1:-}"
    if [[ -z "$username" ]]; then
        echo "Usage: user exists <username>" >&2
        return 1
    fi
    id "$username" &>/dev/null
}

# =============================================================================
# TETRA BOOTSTRAP
# =============================================================================

_user_setup_tetra() {
    local username="${1:-}"

    if [[ -z "$username" ]]; then
        echo "Usage: user setup-tetra <username>" >&2
        return 1
    fi

    if ! id "$username" &>/dev/null; then
        echo "User '$username' does not exist. Create first with: user create $username" >&2
        return 1
    fi

    local home_dir="$(_user_home_base)/$username"
    local devops_dir="$home_dir/src/devops"
    local tetra_src="$devops_dir/tetra"

    echo "Setting up tetra for user '$username'..."

    # Create source directory
    sudo -u "$username" mkdir -p "$home_dir/src"

    # Clone devops repo (public monorepo, tetra is a subdirectory)
    echo "  Cloning devops repository..."
    if [[ ! -d "$devops_dir/.git" ]]; then
        sudo -u "$username" env GIT_TERMINAL_PROMPT=0 \
            git clone https://github.com/study-groups/devops.git "$devops_dir" || {
            echo "  ERROR: Failed to clone devops repo" >&2
            return 1
        }
    else
        echo "  (repo exists, pulling latest)"
        sudo -u "$username" env GIT_TERMINAL_PROMPT=0 \
            git -C "$devops_dir" pull || true
    fi

    # Fix permissions on bash/ (git preserves 700 from source)
    chmod -R a+rX "$tetra_src/bash" 2>/dev/null || true

    # Run setup.sh (must use -H to set HOME for the target user)
    # Use homebrew bash on macOS since tetra requires bash 5.2+
    local bash_bin="bash"
    [[ "$(_user_platform)" == "macos" ]] && bash_bin="/opt/homebrew/bin/bash"

    echo "  Running setup.sh..."
    sudo -Hu "$username" "$bash_bin" "$tetra_src/bash/tetra/init/setup.sh"

    echo ""
    echo "Tetra setup complete for '$username'"
    echo "To test: sudo -u $username -i"
}

_user_remove_tetra() {
    local username="${1:-}"

    if [[ -z "$username" ]]; then
        echo "Usage: user remove-tetra <username>" >&2
        return 1
    fi

    if ! id "$username" &>/dev/null; then
        echo "User '$username' does not exist" >&2
        return 1
    fi

    local home_dir="$(_user_home_base)/$username"
    local tetra_src="$home_dir/src/devops/tetra"
    local remove_sh="$tetra_src/bash/tetra/init/remove.sh"

    if [[ ! -f "$remove_sh" ]]; then
        echo "Remove script not found at $remove_sh" >&2
        echo "Is tetra installed for this user?" >&2
        return 1
    fi

    local bash_bin="bash"
    [[ "$(_user_platform)" == "macos" ]] && bash_bin="/opt/homebrew/bin/bash"

    echo "Running tetra remove for user '$username'..."
    sudo -Hu "$username" "$bash_bin" "$remove_sh"
}

_user_test_install() {
    local username="${1:-tetratest}"

    echo "=== Tetra Install Test ==="
    echo "User: $username"
    echo ""

    # Create user if needed
    if ! id "$username" &>/dev/null; then
        echo "Step 1: Creating user..."
        _user_create "$username" || return 1
    else
        echo "Step 1: User exists"
    fi

    # Setup tetra
    echo ""
    echo "Step 2: Setting up tetra..."
    _user_setup_tetra "$username" || return 1

    # Verify installation
    echo ""
    echo "Step 3: Verifying installation..."
    local home_dir="$(_user_home_base)/$username"
    local bash_bin="bash"
    [[ "$(_user_platform)" == "macos" ]] && bash_bin="/opt/homebrew/bin/bash"

    local checks=0
    local passed=0

    ((checks++))
    if [[ -f "$home_dir/start-tetra.sh" ]]; then
        echo "  [OK] ~/start-tetra.sh exists"
        ((passed++))
    else
        echo "  [FAIL] ~/start-tetra.sh missing"
    fi

    ((checks++))
    if [[ -d "$home_dir/tetra/orgs/tetra" ]]; then
        echo "  [OK] ~/tetra/orgs/tetra exists"
        ((passed++))
    else
        echo "  [FAIL] ~/tetra/orgs/tetra missing"
    fi

    ((checks++))
    if sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && [[ -n "$TETRA_SRC" ]]' 2>/dev/null; then
        echo "  [OK] TETRA_SRC set after sourcing"
        ((passed++))
    else
        echo "  [FAIL] TETRA_SRC not set"
    fi

    ((checks++))
    if sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && type tetra &>/dev/null' 2>/dev/null; then
        echo "  [OK] tetra command available"
        ((passed++))
    else
        echo "  [FAIL] tetra command not available"
    fi

    echo ""
    echo "Results: $passed/$checks passed"

    if [[ $passed -eq $checks ]]; then
        echo ""
        echo "To use: sudo -u $username -i"
        echo "Then:   tetra doctor"
        return 0
    else
        return 1
    fi
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

user() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        create|add|new)
            _user_create "$@"
            ;;
        delete|remove|rm)
            _user_delete "$@"
            ;;
        list|ls)
            _user_list "$@"
            ;;
        status|info|show)
            _user_status "$@"
            ;;
        exists|check)
            _user_exists "$@"
            ;;
        setup-tetra|bootstrap)
            _user_setup_tetra "$@"
            ;;
        remove-tetra|uninstall)
            _user_remove_tetra "$@"
            ;;
        test-install|test)
            _user_test_install "$@"
            ;;
        help|--help|-h)
            _user_help
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            _user_help
            return 1
            ;;
    esac
}

export -f user
export -f _user_platform _user_home_base _user_help
export -f _user_create _user_create_macos _user_create_linux _user_setup_ssh
export -f _user_delete _user_list _user_status _user_exists
export -f _user_setup_tetra _user_remove_tetra _user_test_install

# Load tab completion
[[ -f "${USER_SRC:-$TETRA_SRC/bash/user}/user_complete.sh" ]] && \
    source "${USER_SRC:-$TETRA_SRC/bash/user}/user_complete.sh"
