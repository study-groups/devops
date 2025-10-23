#!/usr/bin/env bash
# Pulsar Play Mode - Auto-setup split terminal with server + client
# Creates tmux session with visual server and REPL client

SESSION_NAME="pulsar-play"
ENGINE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux not found. Install with: brew install tmux"
    echo ""
    echo "Or run manually in two terminals:"
    echo "  Terminal 1: ./pulsar-server.sh"
    echo "  Terminal 2: ./pulsar-client.sh"
    exit 1
fi

# Kill existing session if it exists
tmux kill-session -t "$SESSION_NAME" 2>/dev/null

echo "╔═══════════════════════════════════════╗"
echo "║   ⚡ PULSAR PLAY MODE                ║"
echo "║   Split Terminal Setup               ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "  Creating tmux session: $SESSION_NAME"
echo "  Layout: Server (top) + Client (bottom)"
echo ""
echo "  Controls:"
echo "    Ctrl+B, ↑/↓    Switch panes"
echo "    Ctrl+B, d      Detach session"
echo "    Ctrl+C         Stop server"
echo ""
echo "Starting in 2 seconds..."
sleep 2

# Create new session with server in first pane
tmux new-session -d -s "$SESSION_NAME" -c "$ENGINE_DIR"
tmux send-keys -t "$SESSION_NAME:0.0" './pulsar-server.sh' C-m

# Split window horizontally and start client in bottom pane
tmux split-window -v -t "$SESSION_NAME:0" -c "$ENGINE_DIR"
tmux send-keys -t "$SESSION_NAME:0.1" 'sleep 4 && ./pulsar-client.sh' C-m

# Resize panes (60% server, 40% client)
tmux resize-pane -t "$SESSION_NAME:0.0" -y 20

# Select client pane (where user will type)
tmux select-pane -t "$SESSION_NAME:0.1"

# Attach to session
tmux attach-session -t "$SESSION_NAME"
