#!/usr/bin/env bash
# ubuntu-24.04.sh - Bootstrap Ubuntu 24.04 for tetra deployment
#
# Run as root on fresh DigitalOcean droplet:
#   scp bootstrap/ubuntu-24.04.sh root@<ip>:/tmp/ && ssh root@<ip> '/tmp/ubuntu-24.04.sh'
#
# What this does:
#   1. Updates system packages
#   2. Installs essential tools (git, curl, jq, rsync, build-essential)
#   3. Installs nvm and Node.js LTS
#   4. Optionally installs Caddy web server
#   5. Creates tetra directory structure
#   6. Adds tetra.sh to bashrc

set -e

echo "=== Tetra Bootstrap for Ubuntu 24.04 ==="
echo ""
echo "Hostname: $(hostname)"
echo "Date: $(date)"
echo ""

# =============================================================================
# SYSTEM UPDATES
# =============================================================================

echo "[1/7] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# =============================================================================
# BASH VERSION CHECK
# =============================================================================

echo "[2/7] Verifying bash version..."
BASH_VER=$(bash --version | head -1 | grep -oP '\d+\.\d+' | head -1)
BASH_MAJOR="${BASH_VER%%.*}"
echo "  Bash version: $BASH_VER"

if [[ "$BASH_MAJOR" -lt 5 ]]; then
    echo "ERROR: Bash 5.2+ required (found $BASH_VER)"
    echo "Ubuntu 24.04 should have bash 5.2+. Something is wrong."
    exit 1
fi

echo "  OK"

# =============================================================================
# ESSENTIAL PACKAGES
# =============================================================================

echo "[3/7] Installing essential packages..."
apt-get install -y -qq \
    git \
    curl \
    wget \
    jq \
    tree \
    htop \
    util-linux \
    build-essential \
    rsync \
    unzip \
    ca-certificates \
    gnupg

echo "  Installed: git, curl, wget, jq, tree, htop, rsync, build-essential"

# =============================================================================
# NVM (Node Version Manager)
# =============================================================================

echo "[4/7] Installing nvm..."
export NVM_DIR="$HOME/tetra/nvm"
mkdir -p "$NVM_DIR"

if [[ ! -f "$NVM_DIR/nvm.sh" ]]; then
    # Install nvm to tetra/nvm (not .nvm)
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # Move from .nvm to tetra/nvm if installer created .nvm
    if [[ -d "$HOME/.nvm" && "$NVM_DIR" != "$HOME/.nvm" ]]; then
        cp -r "$HOME/.nvm/"* "$NVM_DIR/" 2>/dev/null || true
        rm -rf "$HOME/.nvm"
    fi
    echo "  Installed nvm to ~/tetra/nvm"
else
    echo "  nvm already installed"
fi

# Load nvm
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node LTS
echo "[5/7] Installing Node.js LTS..."
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'

echo "  Node: $(node --version)"
echo "  npm:  $(npm --version)"

# =============================================================================
# CADDY (Optional - Web Server / Reverse Proxy)
# =============================================================================

echo "[6/7] Installing Caddy..."

# Check if Caddy is already installed
if command -v caddy &>/dev/null; then
    echo "  Caddy already installed: $(caddy version)"
else
    # Install Caddy from official repo
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https

    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
        gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null

    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
        tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null

    apt-get update -qq
    apt-get install -y -qq caddy

    # Stop caddy for now (will be configured later)
    systemctl stop caddy 2>/dev/null || true
    systemctl disable caddy 2>/dev/null || true

    echo "  Installed Caddy: $(caddy version)"
fi

# =============================================================================
# TETRA DIRECTORY STRUCTURE
# =============================================================================

echo "[7/7] Creating tetra directory structure..."

mkdir -p /root/tetra/{bash,server,dashboard,orgs,caddy,logs}

# Create minimal bootloader
cat > /root/tetra/tetra.sh << 'EOF'
#!/usr/bin/env bash
# Tetra bootloader - minimal version
# Full version will be synced from source

# Enforce bash 5.2+
if [[ ${BASH_VERSINFO[0]} -lt 5 || (${BASH_VERSINFO[0]} -eq 5 && ${BASH_VERSINFO[1]} -lt 2) ]]; then
    echo "ERROR: tetra requires bash 5.2+ (found ${BASH_VERSION})" >&2
    return 1 2>/dev/null || exit 1
fi

export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export TETRA_SRC="${TETRA_SRC:-$TETRA_DIR}"

# Load bootloader if present
if [[ -f "$TETRA_SRC/bash/bootloader.sh" ]]; then
    source "$TETRA_SRC/bash/bootloader.sh"
elif [[ -f "$TETRA_SRC/bash/tetra/tetra.sh" ]]; then
    source "$TETRA_SRC/bash/tetra/tetra.sh"
fi
EOF
chmod +x /root/tetra/tetra.sh

# Add to bashrc if not present
if ! grep -q "tetra/tetra.sh" /root/.bashrc 2>/dev/null; then
    cat >> /root/.bashrc << 'BASHRC'

# Tetra
export NVM_DIR="$HOME/tetra/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
source ~/tetra/tetra.sh 2>/dev/null
BASHRC
    echo "  Added tetra.sh and NVM_DIR to .bashrc"
fi

echo "  Created: ~/tetra/{bash,server,dashboard,orgs,caddy,logs}"

# =============================================================================
# FIREWALL (UFW)
# =============================================================================

echo ""
echo "Configuring firewall..."

# Enable UFW if not already
if ! ufw status | grep -q "Status: active"; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    ufw allow 4444/tcp # Tetra server
    ufw --force enable
    echo "  UFW enabled with ports: 22, 80, 443, 4444"
else
    # Just ensure our ports are open
    ufw allow 4444/tcp 2>/dev/null || true
    echo "  UFW already active, ensured port 4444 is open"
fi

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "Installed:"
echo "  - Bash:    $(bash --version | head -1 | grep -oP '\d+\.\d+\.\d+' | head -1)"
echo "  - Node:    $(node --version 2>/dev/null || echo 'N/A')"
echo "  - npm:     $(npm --version 2>/dev/null || echo 'N/A')"
echo "  - Caddy:   $(caddy version 2>/dev/null | head -1 || echo 'N/A')"
echo "  - jq:      $(jq --version 2>/dev/null || echo 'N/A')"
echo ""
echo "Directories:"
echo "  ~/tetra/bash/      - Modules (sync from source)"
echo "  ~/tetra/server/    - Node.js server"
echo "  ~/tetra/dashboard/ - Frontend"
echo "  ~/tetra/orgs/      - Organization data"
echo "  ~/tetra/caddy/     - Web server config"
echo ""
echo "Next steps:"
echo "  1. Create environment users:  nh clone users <host>"
echo "  2. Sync tetra files:          nh clone sync <host> dev all"
echo "  3. Activate services:         nh clone activate <host> dev"
echo ""
echo "Or from local machine:"
echo "  nh clone bootstrap <host>"
