#!/usr/bin/env bash
# Deploy Tetra Systemd Daemon for @dev Environment
# This script installs and configures the systemd daemon on a Linux system

set -euo pipefail

# Colors for output
C_GREEN='\033[0;32m'
C_BLUE='\033[0;34m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_NC='\033[0m' # No Color

echo_info() { echo -e "${C_BLUE}ℹ${C_NC} $*"; }
echo_success() { echo -e "${C_GREEN}✓${C_NC} $*"; }
echo_warn() { echo -e "${C_YELLOW}⚠${C_NC} $*"; }
echo_error() { echo -e "${C_RED}✗${C_NC} $*"; }

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo_error "This script is for Linux systems with systemd only"
    exit 1
fi

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo_error "This script must be run as root or with sudo"
   exit 1
fi

# Configuration
TETRA_SRC="${TETRA_SRC:-/root/src/devops/tetra}"
TETRA_DIR="${TETRA_DIR:-/root/tetra}"
SERVICE_NAME="tetra-dev.service"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME"

echo_info "Tetra Daemon Deployment for @dev Environment"
echo_info "=============================================="
echo ""
echo_info "Configuration:"
echo "  TETRA_SRC: $TETRA_SRC"
echo "  TETRA_DIR: $TETRA_DIR"
echo "  Service:   $SERVICE_NAME"
echo ""

# Verify TETRA_SRC exists
if [[ ! -d "$TETRA_SRC" ]]; then
    echo_error "TETRA_SRC not found: $TETRA_SRC"
    echo_info "Please clone tetra repository first:"
    echo "  mkdir -p /root/src/devops"
    echo "  cd /root/src/devops"
    echo "  git clone <tetra-repo-url> tetra"
    exit 1
fi

echo_success "TETRA_SRC found: $TETRA_SRC"

# Create TETRA_DIR structure
echo_info "Creating TETRA_DIR structure..."
mkdir -p "$TETRA_DIR"/{logs,tsm/{services-available,services-enabled,runtime/processes}}
echo_success "Directory structure created"

# Deploy tetra.sh to TETRA_DIR
echo_info "Deploying tetra.sh to TETRA_DIR..."
if [[ -f "$HOME/tetra/tetra.sh" ]]; then
    cp "$HOME/tetra/tetra.sh" "$TETRA_DIR/tetra.sh"
    echo_success "tetra.sh deployed"
else
    echo_warn "tetra.sh not found in $HOME/tetra/, skipping"
    echo_info "You may need to manually copy tetra.sh to $TETRA_DIR/"
fi

# Deploy service definition
echo_info "Deploying service definition..."
SERVICE_DEF_SRC="$TETRA_SRC/templates/services/tetra-dev.tsm"
SERVICE_DEF_DST="$TETRA_DIR/tsm/services-available/tetra.tsm"

if [[ -f "$SERVICE_DEF_SRC" ]]; then
    cp "$SERVICE_DEF_SRC" "$SERVICE_DEF_DST"
    chmod +x "$SERVICE_DEF_DST"
    echo_success "Service definition deployed: $SERVICE_DEF_DST"
else
    echo_error "Service definition template not found: $SERVICE_DEF_SRC"
    exit 1
fi

# Enable service in TSM
echo_info "Enabling service for auto-start..."
ln -sf "../services-available/tetra.tsm" "$TETRA_DIR/tsm/services-enabled/tetra.tsm"
echo_success "Service enabled in TSM"

# Create environment file if it doesn't exist
ENV_FILE="$TETRA_SRC/env/dev.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo_warn "Environment file not found: $ENV_FILE"
    echo_info "Creating template..."
    mkdir -p "$(dirname "$ENV_FILE")"
    cat > "$ENV_FILE" <<'EOF'
# Tetra Development Environment Configuration
NODE_ENV=development
TETRA_ENV=dev
PORT=4444
TETRA_PORT=4444

# Add your API keys and secrets here
# API_KEY=your-key-here
EOF
    echo_success "Template created: $ENV_FILE"
    echo_warn "Please edit $ENV_FILE with your actual configuration"
fi

# Deploy systemd service file
echo_info "Deploying systemd service file..."
SYSTEMD_TEMPLATE="$TETRA_SRC/templates/systemd/tetra@dev.service"

if [[ ! -f "$SYSTEMD_TEMPLATE" ]]; then
    echo_error "Systemd template not found: $SYSTEMD_TEMPLATE"
    exit 1
fi

cp "$SYSTEMD_TEMPLATE" "$SERVICE_FILE"
echo_success "Service file deployed: $SERVICE_FILE"

# Reload systemd
echo_info "Reloading systemd daemon..."
systemctl daemon-reload
echo_success "Systemd daemon reloaded"

# Enable service for boot
echo_info "Enabling service for boot..."
systemctl enable "$SERVICE_NAME"
echo_success "Service enabled for boot"

# Start service
echo ""
read -p "Start service now? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo_info "Starting service..."
    systemctl start "$SERVICE_NAME"

    # Wait for startup
    sleep 3

    # Check status
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo_success "Service started successfully!"
        echo ""
        systemctl status "$SERVICE_NAME" --no-pager -l
    else
        echo_error "Service failed to start. Check logs:"
        echo "  journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
else
    echo_info "Service not started. Start manually with:"
    echo "  systemctl start $SERVICE_NAME"
fi

echo ""
echo_success "Deployment complete!"
echo ""
echo_info "Next steps:"
echo "  1. Check status:  systemctl status $SERVICE_NAME"
echo "  2. View logs:     journalctl -u $SERVICE_NAME -f"
echo "  3. Test server:   curl http://localhost:4444/health"
echo ""
echo_info "Management commands:"
echo "  systemctl start $SERVICE_NAME      # Start service"
echo "  systemctl stop $SERVICE_NAME       # Stop service"
echo "  systemctl restart $SERVICE_NAME    # Restart service"
echo "  systemctl status $SERVICE_NAME     # Check status"
echo ""
echo_info "Or use TSM commands (after sourcing tetra.sh):"
echo "  source $TETRA_DIR/tetra.sh"
echo "  tsm daemon status"
echo "  tsm daemon logs 50 -f"
