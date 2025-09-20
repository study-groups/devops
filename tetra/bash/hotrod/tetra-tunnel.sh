#!/usr/bin/env bash

# Simplified tetra tunnel management
# Usage: tetra-tunnel.sh [start|stop|status]

TETRA_PORT=4444
REMOTE_USER="${TETRA_REMOTE_USER:-devops}"
REMOTE_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"

case "${1:-status}" in
    start)
        echo "🚇 Starting Tetra tunnel: localhost:$TETRA_PORT → $REMOTE_HOST:$TETRA_PORT"
        pm2 start "$TETRA_SRC/bash/hotrod/tunnel.sh" \
            --name "tetra-tunnel" \
            --interpreter bash \
            --restart-delay 30000 \
            --max-restarts 3 \
            --no-autorestart \
            -- "$TETRA_PORT"
        echo "✅ Tetra now accessible at: https://dev.pixeljamarcade.com:$TETRA_PORT"
        ;;
    stop)
        echo "🛑 Stopping Tetra tunnel"
        pm2 delete tetra-tunnel 2>/dev/null || echo "Tunnel was not running"
        ;;
    status)
        echo "🔍 Tetra tunnel status:"
        pm2 list | grep -E "(tetra-tunnel|tetra-local)" || echo "No tetra processes found"
        echo ""
        echo "💡 Usage:"
        echo "  tetra-tunnel.sh start   # Enable public access"
        echo "  tetra-tunnel.sh stop    # Disable public access"
        echo "  Local access: http://localhost:$TETRA_PORT"
        echo "  Public access: https://dev.pixeljamarcade.com:$TETRA_PORT (when tunnel active)"
        ;;
    *)
        echo "Usage: $0 [start|stop|status]"
        exit 1
        ;;
esac