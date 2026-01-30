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

    case "$platform" in
        macos)
            _user_create_macos "$username" "$admin" >/dev/null 2>&1
            ;;
        linux)
            _user_create_linux "$username" "$admin" >/dev/null 2>&1
            ;;
        *)
            echo "Unsupported platform: $platform" >&2
            return 1
            ;;
    esac

    if ! id "$username" &>/dev/null; then
        printf "  ${RED}✗${RST} failed to create user\n" >&2
        return 1
    fi

    # Setup SSH keys (quiet)
    if [[ "$no_ssh" != "true" ]]; then
        _user_setup_ssh "$username" >/dev/null 2>&1
    fi

    # Clean summary
    local RST=$'\e[0m' DIM=$'\e[2m' GREEN=$'\e[32m'
    local uid; uid=$(id -u "$username")
    local shell; shell=$(dscl . -read "/Users/$username" UserShell 2>/dev/null | awk '{print $2}')
    local fingerprint=""
    [[ -f "$home_dir/.ssh/id_ed25519.pub" ]] && \
        fingerprint=$(ssh-keygen -lf "$home_dir/.ssh/id_ed25519.pub" 2>/dev/null | awk '{print $2}')

    printf "  ${GREEN}✓${RST} %s  ${DIM}uid:%s  %s  %s${RST}\n" \
        "$username" "$uid" "${shell:-bash}" "$platform"
    printf "    ${DIM}home${RST}   %s\n" "$home_dir"
    [[ -n "$fingerprint" ]] && \
        printf "    ${DIM}ssh${RST}    %s\n" "$fingerprint"
    return 0
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

    # Set login shell to homebrew bash 5.2+ (tetra requirement)
    if [[ -x /opt/homebrew/bin/bash ]]; then
        # Ensure homebrew bash is in /etc/shells
        if ! grep -qF /opt/homebrew/bin/bash /etc/shells; then
            echo /opt/homebrew/bin/bash | sudo tee -a /etc/shells >/dev/null
        fi
        sudo dscl . -create "/Users/$username" UserShell /opt/homebrew/bin/bash
    else
        echo "WARNING: /opt/homebrew/bin/bash not found, using /bin/bash (tetra requires 5.2+)" >&2
        sudo dscl . -create "/Users/$username" UserShell /bin/bash
    fi
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

    local RST=$'\e[0m' DIM=$'\e[2m' GREEN=$'\e[32m' RED=$'\e[31m'

    case "$platform" in
        macos)
            sudo sysadminctl -deleteUser "$username" >/dev/null 2>&1
            ;;
        linux)
            sudo userdel -r "$username" >/dev/null 2>&1
            ;;
        *)
            echo "Unsupported platform: $platform" >&2
            return 1
            ;;
    esac

    if id "$username" &>/dev/null; then
        printf "  ${RED}✗${RST} failed to delete %s\n" "$username"
        return 1
    else
        printf "  ${GREEN}✓${RST} deleted  ${DIM}%s${RST}\n" "$username"
    fi
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

    local RST=$'\e[0m' DIM=$'\e[2m' GREEN=$'\e[32m' RED=$'\e[31m' CYAN=$'\e[36m' BOLD=$'\e[1m'

    # Create source directory
    sudo -u "$username" mkdir -p "$home_dir/src"

    # Clone devops repo (public monorepo, tetra is a subdirectory)
    if [[ ! -d "$devops_dir/.git" ]]; then
        printf "  ${DIM}cloning${RST} study-groups/devops..."
        if sudo -u "$username" env GIT_TERMINAL_PROMPT=0 \
            git clone -q https://github.com/study-groups/devops.git "$devops_dir" 2>/dev/null; then
            printf "\r  ${GREEN}✓${RST} cloned  ${DIM}study-groups/devops → src/devops/${RST}\n"
        else
            printf "\r  ${RED}✗${RST} clone failed\n"
            return 1
        fi
    else
        sudo -u "$username" env GIT_TERMINAL_PROMPT=0 \
            git -C "$devops_dir" pull -q 2>/dev/null || true
        printf "  ${GREEN}✓${RST} repo    ${DIM}up to date${RST}\n"
    fi

    # Fix permissions on bash/ (git preserves 700 from source)
    chmod -R a+rX "$tetra_src/bash" 2>/dev/null || true

    # Fix homebrew python bundled pip permissions (installed with user umask 077)
    local pip_bundled="/opt/homebrew/Cellar/python@"*/*/Frameworks/Python.framework/Versions/*/lib/python*/ensurepip/_bundled
    chmod a+r $pip_bundled/*.whl 2>/dev/null || true

    # Run setup.sh (must use -H to set HOME for the target user)
    local bash_bin="bash"
    [[ "$(_user_platform)" == "macos" ]] && bash_bin="/opt/homebrew/bin/bash"

    sudo -Hu "$username" "$bash_bin" "$tetra_src/bash/tetra/init/setup.sh"
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

    # Terminal formatting
    local COLS RST BOLD DIM GREEN RED CYAN
    COLS=$(tput cols 2>/dev/null || echo 60)
    RST=$'\e[0m' BOLD=$'\e[1m' DIM=$'\e[2m'
    GREEN=$'\e[32m' RED=$'\e[31m' CYAN=$'\e[36m'

    _ok()   { printf "  ${GREEN}✓${RST} %s\n" "$1"; }
    _fail() { printf "  ${RED}✗${RST} %s\n" "$1"; }
    _step() { printf "\n${BOLD}${CYAN}▸ %s${RST}\n" "$1"; }
    _hr()   { printf "${DIM}%*s${RST}\n" "$COLS" "" | tr ' ' '─'; }

    _hr
    printf "${BOLD}  Tetra Install Test${RST}  ${DIM}user: %s${RST}\n" "$username"
    _hr

    # Create user if needed
    if ! id "$username" &>/dev/null; then
        _step "Create user"
        _user_create "$username" || return 1
    else
        _step "Create user"
        _ok "exists"
    fi

    # Setup tetra
    _step "Setup tetra"
    _user_setup_tetra "$username" || return 1

    # Verify installation
    _step "Verify"
    local home_dir="$(_user_home_base)/$username"
    local bash_bin="bash"
    [[ "$(_user_platform)" == "macos" ]] && bash_bin="/opt/homebrew/bin/bash"

    local checks=0
    local passed=0

    ((checks++))
    if [[ -f "$home_dir/start-tetra.sh" ]]; then
        _ok "~/start-tetra.sh"; ((passed++))
    else
        _fail "~/start-tetra.sh missing"
    fi

    ((checks++))
    if [[ -d "$home_dir/tetra/orgs/tetra" ]]; then
        _ok "~/tetra/orgs/tetra"; ((passed++))
    else
        _fail "~/tetra/orgs/tetra missing"
    fi

    ((checks++))
    if sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && [[ -n "$TETRA_SRC" ]]' 2>/dev/null; then
        _ok "TETRA_SRC"; ((passed++))
    else
        _fail "TETRA_SRC not set"
    fi

    ((checks++))
    if sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && type tetra &>/dev/null' 2>/dev/null; then
        _ok "tetra command"; ((passed++))
    else
        _fail "tetra command not available"
    fi

    ((checks++))
    local node_path
    node_path=$(sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && command -v node' 2>/dev/null)
    if [[ "$node_path" == *"$username"* ]]; then
        _ok "node  ${DIM}${node_path}${RST}"; ((passed++))
    elif [[ -n "$node_path" ]]; then
        _fail "node from wrong user  ${DIM}${node_path}${RST}"
    else
        _fail "node not found"
    fi

    ((checks++))
    local bun_path
    bun_path=$(sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && command -v bun' 2>/dev/null)
    if [[ "$bun_path" == *"$username"* ]]; then
        local bun_ver
        bun_ver=$(sudo -Hu "$username" "$bash_bin" -c 'source ~/start-tetra.sh && bun --version' 2>/dev/null)
        _ok "bun   ${DIM}${bun_ver} ${bun_path}${RST}"; ((passed++))
    elif [[ -n "$bun_path" ]]; then
        _fail "bun from wrong user  ${DIM}${bun_path}${RST}"
    else
        _fail "bun not found"
    fi

    echo ""
    _hr
    if [[ $passed -eq $checks ]]; then
        printf "  ${BOLD}${GREEN}${passed}/${checks} passed${RST}\n"
        echo ""
        printf "  ${BOLD}Next steps:${RST}\n"
        printf "    ${DIM}1.${RST} sudo -Hu $username $bash_bin -l\n"
        printf "    ${DIM}2.${RST} source ~/start-tetra.sh\n"
        printf "    ${DIM}3.${RST} tetra doctor\n"
        printf "    ${DIM}4.${RST} tsm start tetra\n"
    else
        printf "  ${BOLD}${RED}${passed}/${checks} passed${RST}\n"
    fi
    _hr

    [[ $passed -eq $checks ]]
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
