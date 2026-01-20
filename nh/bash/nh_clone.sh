#!/usr/bin/env bash
# nh_clone.sh - Droplet cloning and tetra deployment
#
# Creates new DigitalOcean droplets and deploys tetra infrastructure
# with per-environment user isolation (dev, staging, prod).
#
# Usage:
#   nh clone create <name>       Create new droplet
#   nh clone bootstrap <host>    Install bash 5.2+, nvm, create users
#   nh clone sync <host> <env>   Rsync directories to env user
#   nh clone activate <host> <env>  Setup TSM, start services
#   nh clone full <name>         Run all phases
#   nh clone migrate             Interactive migration checklist

# =============================================================================
# CONFIGURATION
# =============================================================================

NH_CLONE_DEFAULT_IMAGE="ubuntu-24-04-x64"
NH_CLONE_DEFAULT_SIZE="s-2vcpu-4gb"
NH_CLONE_DEFAULT_REGION="sfo2"

# Git repositories (set these or override with env vars)
NH_CLONE_TETRA_REPO="${NH_CLONE_TETRA_REPO:-git@github.com:mricos/tetra.git}"
NH_CLONE_DEVPAGES_REPO="${NH_CLONE_DEVPAGES_REPO:-}"

# Environment users and their git branches
declare -A NH_CLONE_USER_BRANCH=(
    [dev]="dev"
    [staging]="staging"
    [prod]="main"
)

# Environment users to create
NH_CLONE_USERS=(dev staging prod)

# Port offsets per environment (base + offset = port)
declare -A NH_CLONE_USER_PORT_OFFSET=(
    [dev]=0
    [staging]=100
    [prod]=200
)

# Common rsync excludes
NH_CLONE_COMMON_EXCLUDES=(
    ".git"
    ".DS_Store"
    "*.log"
    "*.bak"
    "__pycache__"
)

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

nh_clone() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        # Workflow phases
        create|c)       nh_clone_create "$@" ;;
        bootstrap|b)    nh_clone_bootstrap "$@" ;;
        git-init|g)     nh_clone_git_init "$@" ;;
        sync|s)         nh_clone_sync "$@" ;;
        activate|a)     nh_clone_activate "$@" ;;

        # Full workflow
        full|f)         nh_clone_full "$@" ;;

        # Status and info
        status|st)      nh_clone_status "$@" ;;

        # User management
        users)          nh_clone_users_create "$@" ;;
        keys)           nh_clone_deploy_keys "$@" ;;

        # Git operations
        pull)           nh_clone_pull "$@" ;;

        # Migration checklist
        migrate|m)      nh_clone_migrate "$@" ;;

        # Help
        help|h|--help)  nh_clone_help "$@" ;;

        *)
            echo "Unknown command: $cmd"
            nh_clone_help
            return 1
            ;;
    esac
}

# =============================================================================
# PHASE 1: CREATE DROPLET
# =============================================================================

# Create new droplet via doctl
# Usage: nh clone create <name> [options]
nh_clone_create() {
    local name="" image="" size="" region="" ssh_keys="" vpc="" dry_run=0
    local tags="tetra,clone"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --image)    image="$2"; shift 2 ;;
            --size)     size="$2"; shift 2 ;;
            --region)   region="$2"; shift 2 ;;
            --ssh-keys) ssh_keys="$2"; shift 2 ;;
            --vpc)      vpc="$2"; shift 2 ;;
            --tags)     tags="$2"; shift 2 ;;
            --dry-run)  dry_run=1; shift ;;
            -*)         echo "Unknown option: $1"; return 1 ;;
            *)          name="$1"; shift ;;
        esac
    done

    [[ -z "$name" ]] && { echo "Usage: nh clone create <name> [options]"; return 1; }

    # Defaults
    image="${image:-$NH_CLONE_DEFAULT_IMAGE}"
    size="${size:-$NH_CLONE_DEFAULT_SIZE}"
    region="${region:-$NH_CLONE_DEFAULT_REGION}"

    # Auto-detect SSH keys if not provided
    if [[ -z "$ssh_keys" ]]; then
        ssh_keys=$(_nh_clone_auto_ssh_keys)
        [[ -z "$ssh_keys" ]] && {
            echo "ERROR: No SSH keys found. Use --ssh-keys or add keys to DigitalOcean"
            return 1
        }
    fi

    # Build doctl command
    local cmd="doctl compute droplet create $name"
    cmd+=" --image $image"
    cmd+=" --size $size"
    cmd+=" --region $region"
    cmd+=" --ssh-keys $ssh_keys"
    cmd+=" --tag-names $tags"
    cmd+=" --wait"
    [[ -n "$vpc" ]] && cmd+=" --vpc-uuid $vpc"

    echo "=== Create Droplet ==="
    echo ""
    echo "Name:    $name"
    echo "Image:   $image"
    echo "Size:    $size"
    echo "Region:  $region"
    echo "Tags:    $tags"
    echo ""

    if [[ $dry_run -eq 1 ]]; then
        echo "[DRY RUN] Would execute:"
        echo "  $cmd"
        return 0
    fi

    echo "Creating droplet..."
    eval "$cmd" || return 1

    # Fetch updated infrastructure
    echo ""
    echo "Refreshing infrastructure data..."
    nh_doctl_fetch >/dev/null
    nh_env_load >/dev/null

    # Get the new IP
    local varname="${name//-/_}"
    local ip="${!varname}"

    echo ""
    echo "=== Droplet Created ==="
    echo "Name: $name"
    echo "IP:   $ip (\$$varname)"
    echo ""
    echo "Next: nh clone bootstrap $name"

    # Store clone state
    _nh_clone_state_set "${varname}_phase" "created"
    _nh_clone_state_set "${varname}_created" "$(date -Iseconds)"
}

# =============================================================================
# PHASE 2: BOOTSTRAP
# =============================================================================

# Bootstrap droplet with bash 5.2+, nvm, create users
# Usage: nh clone bootstrap <host|name>
nh_clone_bootstrap() {
    local target="$1"
    [[ -z "$target" ]] && { echo "Usage: nh clone bootstrap <host|name>"; return 1; }

    # Resolve to IP if name given
    local host
    host=$(_nh_clone_resolve_host "$target") || return 1

    echo "=== Bootstrap: $host ==="
    echo ""

    # [1/6] Check SSH connectivity
    echo "[1/6] Checking SSH connectivity..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "root@$host" 'echo OK' >/dev/null 2>&1; then
        echo "  ERROR: Cannot connect to root@$host"
        echo "  Check SSH key or wait for droplet to finish provisioning"
        return 1
    fi
    echo "  Connected"

    # [2/6] Check current bash version
    echo "[2/6] Checking bash version..."
    local bash_version
    bash_version=$(ssh "root@$host" 'bash --version | head -1')
    echo "  $bash_version"

    # [3/6] Upload and run bootstrap script
    echo "[3/6] Running bootstrap script..."
    local bootstrap_script="$NH_SRC/../bootstrap/ubuntu-24.04.sh"
    if [[ -f "$bootstrap_script" ]]; then
        scp -q "$bootstrap_script" "root@$host:/tmp/bootstrap.sh"
        ssh "root@$host" "chmod +x /tmp/bootstrap.sh && /tmp/bootstrap.sh"
    else
        echo "  WARNING: Bootstrap script not found: $bootstrap_script"
        echo "  Running inline bootstrap..."
        _nh_clone_inline_bootstrap "root@$host"
    fi

    # [4/6] Create environment users
    echo "[4/6] Creating environment users..."
    for user in "${NH_CLONE_USERS[@]}"; do
        nh_clone_user_create "$host" "$user"
    done

    # [5/6] Deploy SSH keys
    echo "[5/6] Deploying SSH keys..."
    nh_clone_deploy_keys "$host"

    # [6/6] Verify
    echo "[6/6] Verifying installation..."
    local bash_ok node_ok
    ssh "root@$host" 'bash -c "[[ ${BASH_VERSINFO[0]} -ge 5 ]]"' && bash_ok=1 || bash_ok=0
    ssh "root@$host" 'source ~/tetra/nvm/nvm.sh 2>/dev/null && node --version' >/dev/null 2>&1 && node_ok=1 || node_ok=0

    [[ $bash_ok -eq 1 ]] && echo "  Bash 5.2+: OK" || echo "  WARNING: Bash upgrade may have failed"
    [[ $node_ok -eq 1 ]] && echo "  Node.js: OK" || echo "  WARNING: Node.js may not be installed"

    local varname="${target//-/_}"
    _nh_clone_state_set "${varname}_phase" "bootstrapped"

    echo ""
    echo "=== Bootstrap complete ==="
    echo ""
    echo "Next: nh clone sync $target dev all"
}

# Inline bootstrap when script not found
_nh_clone_inline_bootstrap() {
    local target="$1"

    ssh "$target" '
        set -e
        apt-get update
        apt-get upgrade -y
        apt-get install -y git curl wget jq tree htop rsync build-essential

        # Create tetra structure first
        mkdir -p ~/tetra/{bash,server,dashboard,orgs,nvm}

        # Install nvm to tetra/nvm (not .nvm)
        export NVM_DIR="$HOME/tetra/nvm"
        if [[ ! -f "$NVM_DIR/nvm.sh" ]]; then
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
            # Move from .nvm if installer created it there
            if [[ -d "$HOME/.nvm" ]]; then
                cp -r "$HOME/.nvm/"* "$NVM_DIR/" 2>/dev/null || true
                rm -rf "$HOME/.nvm"
            fi
        fi
        source "$NVM_DIR/nvm.sh"
        nvm install --lts
        nvm alias default lts/*

        # Create bootloader
        cat > ~/tetra/tetra.sh << "TETRAEOF"
#!/usr/bin/env bash
export TETRA_DIR="$HOME/tetra"
export TETRA_SRC="$TETRA_DIR"
export NVM_DIR="$TETRA_DIR/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[[ -f "$TETRA_SRC/bash/bootloader.sh" ]] && source "$TETRA_SRC/bash/bootloader.sh"
TETRAEOF
        chmod +x ~/tetra/tetra.sh

        # Add to bashrc
        grep -q "tetra/tetra.sh" ~/.bashrc 2>/dev/null || \
            echo "source ~/tetra/tetra.sh 2>/dev/null" >> ~/.bashrc
    '
}

# =============================================================================
# PHASE 2.5: GIT INIT
# =============================================================================

# Clone git repos for each user
# Usage: nh clone git-init <host> [user]
nh_clone_git_init() {
    local host="$1"
    local specific_user="$2"

    [[ -z "$host" ]] && { echo "Usage: nh clone git-init <host> [user]"; return 1; }

    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1

    echo "=== Git Init: $ip ==="
    echo "Repo: $NH_CLONE_TETRA_REPO"
    echo ""

    # Determine which users to process
    local users_to_process=()
    if [[ -n "$specific_user" ]]; then
        users_to_process=("$specific_user")
    else
        users_to_process=("${NH_CLONE_USERS[@]}")
    fi

    for user in "${users_to_process[@]}"; do
        local branch="${NH_CLONE_USER_BRANCH[$user]:-main}"
        echo "[$user] Cloning branch: $branch"

        ssh "root@$ip" "
            # Create src directory structure
            sudo -u $user mkdir -p /home/$user/src/devops

            # Clone or update tetra repo
            if [[ -d /home/$user/src/devops/tetra/.git ]]; then
                echo '  Repo exists, pulling...'
                sudo -u $user bash -c 'cd /home/$user/src/devops/tetra && git fetch origin && git checkout $branch && git pull origin $branch'
            else
                echo '  Cloning fresh...'
                sudo -u $user bash -c 'cd /home/$user/src/devops && git clone -b $branch $NH_CLONE_TETRA_REPO tetra'
            fi

            # Update tetra.sh to use correct TETRA_SRC
            cat > /home/$user/tetra/tetra.sh << 'TETRAEOF'
#!/usr/bin/env bash
export TETRA_ENV=\"$user\"
export TETRA_DIR=\"\$HOME/tetra\"
export TETRA_SRC=\"\$HOME/src/devops/tetra\"
export NVM_DIR=\"\$TETRA_DIR/nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"
[[ -f \"\$TETRA_SRC/bash/tetra/tetra.sh\" ]] && source \"\$TETRA_SRC/bash/tetra/tetra.sh\"
TETRAEOF
            chown $user:$user /home/$user/tetra/tetra.sh
            chmod +x /home/$user/tetra/tetra.sh
        " 2>/dev/null && echo "  OK" || echo "  FAILED"
    done

    local varname="${host//-/_}"
    _nh_clone_state_set "${varname}_phase" "git-init"

    echo ""
    echo "=== Git init complete ==="
    echo ""
    echo "Next: nh clone sync $host <env> config"
}

# Pull latest code for a user
# Usage: nh clone pull <host> <env>
nh_clone_pull() {
    local host="$1"
    local env="${2:-dev}"

    [[ -z "$host" ]] && { echo "Usage: nh clone pull <host> <env>"; return 1; }

    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1
    local branch="${NH_CLONE_USER_BRANCH[$env]:-main}"

    echo "Pulling $branch for $env@$ip..."

    ssh "$env@$ip" "
        cd ~/src/devops/tetra && \
        git fetch origin && \
        git checkout $branch && \
        git pull origin $branch && \
        echo 'Current commit:' && \
        git log -1 --oneline
    "
}

# =============================================================================
# PHASE 3: SYNC (configs and secrets, NOT code)
# =============================================================================

# Sync config/runtime directories to specific env user
# Code comes from git (nh clone git-init), this syncs TETRA_DIR only
# Usage: nh clone sync <host> <env> [component...]
nh_clone_sync() {
    local host="" env="" components=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            dev|staging|prod) env="$1"; shift ;;
            nvm|org|config|all) components+=("$1"); shift ;;
            -*) echo "Unknown option: $1"; return 1 ;;
            *) [[ -z "$host" ]] && host="$1" || components+=("$1"); shift ;;
        esac
    done

    [[ -z "$host" ]] && { echo "Usage: nh clone sync <host> <env> [component...]"; return 1; }
    [[ -z "$env" ]] && env="dev"
    [[ ${#components[@]} -eq 0 ]] && components=("all")

    echo "NOTE: Code comes from git. Use 'nh clone git-init' or 'nh clone pull' for code."
    echo "      This syncs TETRA_DIR (configs, nvm, orgs) only."
    echo ""

    # Resolve host
    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1
    local target="$env@$ip"

    echo "=== Sync to $target ==="
    echo "Components: ${components[*]}"
    echo ""

    for comp in "${components[@]}"; do
        case "$comp" in
            all)
                _nh_clone_sync_org "$target"
                ;;
            org)       _nh_clone_sync_org "$target" ;;
        esac
    done

    echo ""
    echo "NOTE: For nvm/node, SSH in and run: tetra_nvm_install"
    echo "      For python, SSH in and run: tetra_python_install (if needed)"

    local varname="${host//-/_}"
    _nh_clone_state_set "${varname}_phase" "synced:$env"

    echo ""
    echo "=== Sync complete ==="
    echo ""
    echo "Next: nh clone activate $host $env"
}

# Sync org configurations
_nh_clone_sync_org() {
    local target="$1"
    local org="${2:-}"

    # Try to get active org
    [[ -z "$org" ]] && type org_active &>/dev/null && org=$(org_active 2>/dev/null)
    [[ -z "$org" ]] && { echo "  ERROR: No org specified"; return 1; }

    local src="${TETRA_DIR:-$HOME/tetra}/orgs/$org/"
    [[ ! -d "$src" ]] && { echo "  ERROR: Org not found: $src"; return 1; }

    local dest="tetra/orgs/$org/"

    echo "  Syncing: org ($org)"
    echo "  WARNING: secrets.env NOT synced (transfer manually)"
    _nh_clone_rsync "$src" "$target:$dest" ".git" "secrets.env" "*.env.local" "tkm/keys"
}

# Generic rsync wrapper
_nh_clone_rsync() {
    local src="$1"
    local dest="$2"
    shift 2
    local excludes=("$@")

    local opts="-avz --delete"

    # Build exclude args
    local exclude_args=""
    for excl in "${NH_CLONE_COMMON_EXCLUDES[@]}" "${excludes[@]}"; do
        exclude_args+=" --exclude='$excl'"
    done

    eval rsync $opts $exclude_args "'$src'" "'$dest'" 2>/dev/null
}

# =============================================================================
# PHASE 4: ACTIVATE
# =============================================================================

# Setup systemd services and start TSM
# Usage: nh clone activate <host> <env>
nh_clone_activate() {
    local host="$1" env="${2:-dev}"

    [[ -z "$host" ]] && { echo "Usage: nh clone activate <host> <env>"; return 1; }

    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1
    local target="$env@$ip"

    echo "=== Activate: $target ==="
    echo ""

    # [1/4] Verify sync
    echo "[1/4] Verifying tetra installation..."
    if ! ssh "$target" 'test -f ~/tetra/tetra.sh' 2>/dev/null; then
        echo "  ERROR: tetra not found. Run 'nh clone sync' first."
        return 1
    fi
    echo "  tetra.sh found"

    # [2/4] Install npm dependencies
    echo "[2/4] Installing npm dependencies..."
    ssh "$target" 'source ~/tetra/nvm/nvm.sh 2>/dev/null && cd ~/tetra/server && npm install --production' 2>/dev/null || {
        echo "  WARNING: npm install may have failed"
    }

    # [3/4] Load tetra and check TSM
    echo "[3/4] Checking TSM..."
    ssh "$target" 'source ~/tetra/tetra.sh 2>/dev/null && type tsm' >/dev/null 2>&1 && {
        echo "  TSM available"
    } || {
        echo "  WARNING: TSM not available"
    }

    # [4/4] List services
    echo "[4/4] Services status..."
    ssh "$target" 'source ~/tetra/tetra.sh 2>/dev/null && tsm list 2>/dev/null' || {
        echo "  (no services running)"
    }

    local varname="${host//-/_}"
    _nh_clone_state_set "${varname}_phase" "activated:$env"

    echo ""
    echo "=== Activation complete ==="
    echo ""
    echo "Connect: ssh $target"
    echo "Start:   ssh $target 'source ~/tetra/tetra.sh && tsm startup'"
}

# =============================================================================
# FULL WORKFLOW
# =============================================================================

# Run all phases
nh_clone_full() {
    local name="$1"
    local env="${2:-dev}"

    [[ -z "$name" ]] && { echo "Usage: nh clone full <name> [env]"; return 1; }

    echo "=== Full Clone Workflow ==="
    echo "Target: $name"
    echo "Environment: $env"
    echo ""

    echo "Phase 1/5: Create droplet"
    nh_clone_create "$name" || return 1

    echo ""
    echo "Waiting 30s for droplet to initialize..."
    sleep 30

    echo ""
    echo "Phase 2/5: Bootstrap (system deps, users)"
    nh_clone_bootstrap "$name" || return 1

    echo ""
    echo "Phase 3/5: Git init (clone repos)"
    nh_clone_git_init "$name" || return 1

    echo ""
    echo "Phase 4/5: Sync configs"
    nh_clone_sync "$name" "$env" all || return 1

    echo ""
    echo "Phase 5/5: Install nvm & activate"
    # Install nvm for the target user
    local ip
    ip=$(_nh_clone_resolve_host "$name") || return 1
    echo "Installing nvm for $env user..."
    ssh "$env@$ip" 'source ~/tetra/tetra.sh && tetra_nvm_install' 2>/dev/null || {
        echo "WARNING: tetra_nvm_install may have failed"
    }

    nh_clone_activate "$name" "$env" || return 1

    echo ""
    echo "=== Full workflow complete ==="
    echo ""
    echo "Users created: ${NH_CLONE_USERS[*]}"
    echo "Each user has:"
    echo "  ~/src/devops/tetra/  - git clone (TETRA_SRC)"
    echo "  ~/tetra/             - runtime config (TETRA_DIR)"
    echo ""
    echo "To deploy updates: nh clone pull $name <env>"
}

# =============================================================================
# USER MANAGEMENT
# =============================================================================

# Create a single environment user
nh_clone_user_create() {
    local host="$1"
    local username="$2"

    [[ -z "$host" || -z "$username" ]] && {
        echo "Usage: nh_clone_user_create <host> <username>"
        return 1
    }

    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1

    echo "  Creating user: $username"

    # Get the branch for this user
    local branch="${NH_CLONE_USER_BRANCH[$username]:-main}"

    ssh "root@$ip" "
        # Create user if doesn't exist
        if ! id '$username' &>/dev/null; then
            useradd -m -s /bin/bash '$username'
        fi

        # Create directory structure
        # TETRA_SRC = ~/src/devops/tetra (git clone, code)
        # TETRA_DIR = ~/tetra (runtime, configs, orgs, nvm)
        mkdir -p /home/$username/src/devops
        mkdir -p /home/$username/tetra/{orgs,nvm,logs,tsm}

        # Create tetra.sh bootloader with proper paths
        cat > /home/$username/tetra/tetra.sh << 'TETRAEOF'
#!/usr/bin/env bash
export TETRA_ENV=\"$username\"
export TETRA_DIR=\"\$HOME/tetra\"
export TETRA_SRC=\"\$HOME/src/devops/tetra\"
export NVM_DIR=\"\$TETRA_DIR/nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"
[[ -f \"\$TETRA_SRC/bash/tetra/tetra.sh\" ]] && source \"\$TETRA_SRC/bash/tetra/tetra.sh\"
TETRAEOF
        chmod +x /home/$username/tetra/tetra.sh

        # Setup .bashrc
        grep -q 'tetra/tetra.sh' /home/$username/.bashrc 2>/dev/null || \
            echo 'source ~/tetra/tetra.sh 2>/dev/null' >> /home/$username/.bashrc

        # Fix ownership
        chown -R '$username:$username' /home/$username/

        # Setup SSH directory
        mkdir -p /home/$username/.ssh
        chmod 700 /home/$username/.ssh
        touch /home/$username/.ssh/authorized_keys
        chmod 600 /home/$username/.ssh/authorized_keys
        chown -R '$username:$username' /home/$username/.ssh
    " 2>/dev/null
}

# Create all environment users
nh_clone_users_create() {
    local host="$1"

    [[ -z "$host" ]] && { echo "Usage: nh clone users <host>"; return 1; }

    echo "Creating environment users on $host..."
    for user in "${NH_CLONE_USERS[@]}"; do
        nh_clone_user_create "$host" "$user"
    done
}

# Deploy SSH keys to all users
nh_clone_deploy_keys() {
    local host="" keyfile=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --key) keyfile="$2"; shift 2 ;;
            *)     host="$1"; shift ;;
        esac
    done

    [[ -z "$host" ]] && { echo "Usage: nh clone keys <host> [--key <keyfile>]"; return 1; }

    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1

    # Auto-detect key
    if [[ -z "$keyfile" ]]; then
        # Try common locations
        for f in ~/.ssh/id_ed25519 ~/.ssh/id_rsa; do
            [[ -f "$f" ]] && { keyfile="$f"; break; }
        done
    fi

    [[ -z "$keyfile" ]] && { echo "ERROR: No SSH key found. Use --key"; return 1; }

    local pubkey="${keyfile}.pub"
    [[ ! -f "$pubkey" ]] && { echo "ERROR: Public key not found: $pubkey"; return 1; }

    local pubkey_content
    pubkey_content=$(cat "$pubkey")

    echo "Deploying SSH key to users on $ip..."

    # Deploy to root
    echo "  root"
    ssh "root@$ip" "
        grep -qF '${pubkey_content}' /root/.ssh/authorized_keys 2>/dev/null || \
            echo '${pubkey_content}' >> /root/.ssh/authorized_keys
    " 2>/dev/null

    # Deploy to each env user
    for user in "${NH_CLONE_USERS[@]}"; do
        echo "  $user"
        ssh "root@$ip" "
            mkdir -p /home/$user/.ssh
            grep -qF '${pubkey_content}' /home/$user/.ssh/authorized_keys 2>/dev/null || \
                echo '${pubkey_content}' >> /home/$user/.ssh/authorized_keys
            chown -R $user:$user /home/$user/.ssh
            chmod 700 /home/$user/.ssh
            chmod 600 /home/$user/.ssh/authorized_keys
        " 2>/dev/null
    done
}

# =============================================================================
# MIGRATION
# =============================================================================

nh_clone_migrate() {
    local checklist="${NH_SRC:-}/../checklists/tetra-migrate.toml"

    if [[ ! -f "$checklist" ]]; then
        echo "Migration checklist not found: $checklist"
        echo ""
        echo "Create one with: nh clone migrate init"
        return 1
    fi

    echo "Migration checklist: $checklist"
    echo ""
    echo "Use 'nh cl' to browse checklists interactively"
}

# =============================================================================
# STATUS
# =============================================================================

nh_clone_status() {
    local host="$1"

    if [[ -z "$host" ]]; then
        # Show all clone states
        local state_file=$(_nh_clone_state_file)
        if [[ -f "$state_file" ]]; then
            echo "Clone States"
            echo "============"
            cat "$state_file"
        else
            echo "No clone state found"
        fi
        return
    fi

    local ip
    ip=$(_nh_clone_resolve_host "$host") || return 1
    local varname="${host//-/_}"

    echo "Clone Status: $host ($ip)"
    echo "=========================="

    local phase=$(_nh_clone_state_get "${varname}_phase")
    local created=$(_nh_clone_state_get "${varname}_created")

    echo "Phase:   ${phase:-unknown}"
    echo "Created: ${created:-unknown}"
    echo ""

    # Check connectivity
    echo "Connectivity:"
    for user in root "${NH_CLONE_USERS[@]}"; do
        if ssh -o ConnectTimeout=5 -o BatchMode=yes "$user@$ip" 'echo OK' >/dev/null 2>&1; then
            echo "  $user@$ip: OK"
        else
            echo "  $user@$ip: FAILED"
        fi
    done
}

# =============================================================================
# HELPERS
# =============================================================================

# Auto-detect SSH keys from DO
_nh_clone_auto_ssh_keys() {
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    local json="$NH_DIR/$ctx/digocean.json"

    if [[ -f "$json" ]]; then
        local key_ids
        key_ids=$(jq -r '.[] | select(.SSHKeys) | .SSHKeys[].id' "$json" 2>/dev/null | head -5 | tr '\n' ',' | sed 's/,$//')
        [[ -n "$key_ids" ]] && { echo "$key_ids"; return; }
    fi

    # Fallback: use doctl
    doctl compute ssh-key list --format ID --no-header 2>/dev/null | head -3 | tr '\n' ',' | sed 's/,$//'
}

# Resolve droplet name to IP
_nh_clone_resolve_host() {
    local target="$1"

    # If already an IP, return as-is
    if [[ "$target" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "$target"
        return 0
    fi

    # Try as shell variable
    local var="${target//-/_}"
    if [[ -n "${!var:-}" ]]; then
        echo "${!var}"
        return 0
    fi

    # Try from digocean.json
    local ctx="${DIGITALOCEAN_CONTEXT:-}"
    local json="$NH_DIR/$ctx/digocean.json"

    if [[ -f "$json" ]]; then
        local ip
        ip=$(jq -r ".[] | select(.Droplets) | .Droplets[] | select(.name == \"$target\") | .networks.v4[] | select(.type==\"public\") | .ip_address" "$json" 2>/dev/null | head -1)
        if [[ -n "$ip" ]]; then
            echo "$ip"
            return 0
        fi
    fi

    echo "Cannot resolve host: $target" >&2
    return 1
}

# State file location
_nh_clone_state_file() {
    local ctx="${DIGITALOCEAN_CONTEXT:-default}"
    echo "$NH_DIR/$ctx/clone-state.env"
}

# Set state value
_nh_clone_state_set() {
    local key="$1"
    local value="$2"
    local state_file=$(_nh_clone_state_file)

    mkdir -p "$(dirname "$state_file")"

    if grep -q "^${key}=" "$state_file" 2>/dev/null; then
        # macOS compatible sed
        if [[ "$(uname)" == "Darwin" ]]; then
            sed -i '' "s|^${key}=.*|${key}=\"${value}\"|" "$state_file"
        else
            sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$state_file"
        fi
    else
        echo "${key}=\"${value}\"" >> "$state_file"
    fi
}

# Get state value
_nh_clone_state_get() {
    local key="$1"
    local state_file=$(_nh_clone_state_file)

    [[ -f "$state_file" ]] && grep "^${key}=" "$state_file" | cut -d= -f2- | tr -d '"'
}

# =============================================================================
# HELP
# =============================================================================

nh_clone_help() {
    local topic="${1:-}"

    case "$topic" in
        create)
            cat << 'EOF'
nh clone create - Provision new DigitalOcean droplet

USAGE: nh clone create <name> [options]

OPTIONS
    --image <slug>      Image (default: ubuntu-24-04-x64)
    --size <slug>       Size (default: s-2vcpu-4gb)
    --region <slug>     Region (default: sfo2)
    --ssh-keys <ids>    SSH key IDs (comma-separated)
    --vpc <id>          VPC UUID
    --tags <tags>       Tags (default: tetra,clone)
    --dry-run           Preview without creating

EXAMPLES
    nh clone create do4n3
    nh clone create do4n3 --size s-4vcpu-8gb --region sfo3
    nh clone create do4n3 --dry-run
EOF
            ;;
        bootstrap)
            cat << 'EOF'
nh clone bootstrap - Install bash 5.2+, nvm, create users

USAGE: nh clone bootstrap <host|name>

STEPS
    1. Check SSH connectivity
    2. Verify/upgrade bash version
    3. Run bootstrap script (Ubuntu 24.04)
    4. Create environment users (dev, staging, prod)
    5. Deploy SSH keys
    6. Verify installation

EXAMPLES
    nh clone bootstrap do4n3
    nh clone bootstrap 165.227.6.221
EOF
            ;;
        sync)
            cat << 'EOF'
nh clone sync - Sync TETRA_DIR configs (NOT code)

Code comes from git (nh clone git-init). This syncs runtime configs only.

USAGE: nh clone sync <host> <env> [component...]

ENVIRONMENTS
    dev, staging, prod

COMPONENTS
    org         Organization configs (NOT secrets.env)
    all         All config components

NOTE: Secrets must be transferred manually, never via rsync.

EXAMPLES
    nh clone sync do4n3 dev all
    nh clone sync do4n3 prod org
EOF
            ;;
        git-init)
            cat << 'EOF'
nh clone git-init - Clone tetra repo for each user

USAGE: nh clone git-init <host> [user]

Clones the tetra repo to ~/src/devops/tetra for each user,
checking out the appropriate branch (dev→dev, staging→staging, prod→main).

EXAMPLES
    nh clone git-init do4n3        # Clone for all users
    nh clone git-init do4n3 prod   # Clone for prod user only
EOF
            ;;
        pull)
            cat << 'EOF'
nh clone pull - Pull latest code for a user

USAGE: nh clone pull <host> <env>

SSHes to the server and runs git pull on the appropriate branch.

EXAMPLES
    nh clone pull do4n3 dev     # Pull dev branch for dev user
    nh clone pull do4n3 prod    # Pull main branch for prod user
EOF
            ;;
        *)
            cat << 'EOF'
nh clone - Droplet cloning and tetra deployment

ARCHITECTURE
    ~/src/devops/tetra/     TETRA_SRC (git clone, code)
    ~/tetra/                TETRA_DIR (runtime, configs, orgs, nvm)

WORKFLOW PHASES
    create      Provision droplet via doctl
    bootstrap   Install system deps, create users (dev, staging, prod)
    git-init    Clone tetra repo for each user
    sync        Rsync TETRA_DIR configs (NOT code)
    activate    Install nvm, start TSM

COMMANDS
    create <name>           Create new droplet
    bootstrap <host>        Bootstrap droplet
    git-init <host>         Clone repos for each user
    sync <host> <env>       Sync configs to user
    activate <host> <env>   Activate TSM services

    full <name>             Run all phases
    pull <host> <env>       Git pull for a user (deploy)

    status [host]           Show clone status
    users <host>            Create env users
    keys <host>             Deploy SSH keys
    migrate                 Migration checklist

TOPICS
    nh clone help create
    nh clone help git-init
    nh clone help pull
    nh clone help bootstrap
    nh clone help sync

EXAMPLES
    # Full workflow
    nh clone create do4n3
    nh clone bootstrap do4n3
    nh clone sync do4n3 dev all
    nh clone activate do4n3 dev

    # Or all at once
    nh clone full do4n3

    # Check status
    nh clone status do4n3
EOF
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f nh_clone nh_clone_create nh_clone_bootstrap nh_clone_sync nh_clone_activate
export -f nh_clone_git_init nh_clone_pull
export -f nh_clone_full nh_clone_status nh_clone_users_create nh_clone_deploy_keys
export -f nh_clone_user_create nh_clone_migrate nh_clone_help
export -f _nh_clone_resolve_host _nh_clone_auto_ssh_keys
export -f _nh_clone_state_file _nh_clone_state_set _nh_clone_state_get
export -f _nh_clone_rsync _nh_clone_inline_bootstrap
export -f _nh_clone_sync_org
