#!/usr/bin/env bash

REMOTE_USER="${TETRA_REMOTE_USER:-devops}"
REMOTE_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"
LOCAL_PORT=$1
REMOTE_PORT=$1

export AUTOSSH_GATETIME=0
export AUTOSSH_LOGLEVEL=7
export AUTOSSH_LOGFILE="${TETRA_DIR:-$HOME/.tetra}/hotrod/logs/autossh-$REMOTE_PORT.log"

exec autossh -M 0 -N \
  -o "ServerAliveInterval=30" \
  -o "ServerAliveCountMax=3" \
  -o "ExitOnForwardFailure=yes" \
  -R "${REMOTE_PORT}:localhost:${LOCAL_PORT}" \
  "${REMOTE_USER}@${REMOTE_HOST}"
```

Make executable:


🚀 3. CLI Entrypoint: ~/.hotrod/bin/hotrod

```bash
#!/usr/bin/env bash

TETRA_DIR="${TETRA_DIR:-$HOME/.tetra}"
HOTROD_DIR="$TETRA_DIR/hotrod"
CONFIG_FILE="$HOTROD_DIR/config.json"
SCRIPT_DIR="$HOTROD_DIR/scripts"
ENTRYPOINTS_DIR="$SCRIPT_DIR/entrypoints"

mkdir -p "$HOTROD_DIR/logs"

DEFAULT_USER="${TETRA_REMOTE_USER:-devops}"
DEFAULT_HOST="${TETRA_REMOTE:-ssh.nodeholder.com}"

function ensure_config_file() {
  [[ -f "$CONFIG_FILE" ]] || echo "{}" > "$CONFIG_FILE"
}

function save_config() {
  echo "$1" > "$CONFIG_FILE"
}

function get_config() {
  cat "$CONFIG_FILE"
}

function app_entrypoint_exists() {
  APPNAME=$1
  [[ -x "$ENTRYPOINTS_DIR/${APPNAME}.sh" ]]
}

function add_app() {
  PORT=$1
  APPNAME=$2

  if ! app_entrypoint_exists "$APPNAME"; then
    echo "❌ No entrypoint found for $APPNAME"
    exit 1
  fi

  CONFIG=$(get_config)
  NEW_CONFIG=$(echo "$CONFIG" | jq ". + {\"$PORT\": \"$APPNAME\"}")
  save_config "$NEW_CONFIG"

  pm2 start "$SCRIPT_DIR/tunnel.sh" --name "hr-tunnel-$PORT" --interpreter bash -- "$PORT"
  pm2 start "$ENTRYPOINTS_DIR/${APPNAME}.sh" --name "hr-${PORT}-${APPNAME}" --interpreter bash -- "$PORT"

  echo "🚗 Hotrod app '$APPNAME' started on port $PORT"
}

function remove_app() {
  PORT=$1

  CONFIG=$(get_config)
  if ! echo "$CONFIG" | jq -e "has(\"$PORT\")" > /dev/null; then
    echo "⚠️  No app mapped to port $PORT"
    exit 1
  fi

  APPNAME=$(echo "$CONFIG" | jq -r ".\"$PORT\"")

  pm2 delete "hr-tunnel-$PORT"
  pm2 delete "hr-${PORT}-${APPNAME}"

  NEW_CONFIG=$(echo "$CONFIG" | jq "del(.\"$PORT\")")
  save_config "$NEW_CONFIG"

  echo "🗑️  Removed app $APPNAME on port $PORT"
}

function list_apps() {
  echo "📦 Hotrod Apps"
  jq -r 'to_entries[] | "\(.key) => \(.value)"' "$CONFIG_FILE"
  echo ""
  pm2 list | grep 'hr-'
}

function usage() {
  echo "Usage:"
  echo "  hotrod add <port> <appname>"
  echo "  hotrod rm <port>"
  echo "  hotrod list"
}

ensure_config_file

case $1 in
  add) add_app "$2" "$3";;
  rm)  remove_app "$2";;
  list) list_apps;;
  *) usage;;
esac
```

Make sure to:

```bash
chmod +x ~/.hotrod/bin/hotrod
ln -sf ~/.hotrod/bin/hotrod ~/bin/hotrod
export PATH="$HOME/bin:$PATH"  # if not already in .bashrc or .zshrc
```

🧪 4. Register Clipboard App

Launch everything:

```bash
hotrod add 9999 clipboard
```

Check PM2 Status:

```bash
pm2 list
```

You should see:

```
📦 Hotrod Apps
9999 => clipboard

App name            id  status
hr-tunnel-9999      0   online
hr-9999-clipboard   1   online
```

📤 5. Send Clipboard Content Remotely

On remote machine:

```bash
echo "Hello from the cloud!" | socat - TCP:localhost:9999
```

📋 Copied into local clipboard! 🎉

📄 Logs saved to:

- ~/.tetra/hotrod/clipboard.log

🧩 Summary Features

- ✅ Modular per-app entrypoints
- ✅ TETRA_DIR-aware configuration
- ✅ Clipboard forwarding with pbcopy / xclip
- ✅ Robust logging system
- ✅ autossh + PM2 process supervision
- ✅ CLI: hotrod add, rm, list

💡 Want to extend?

- Split clipboard into send / receive apps
- Add GUI frontend with Tauri / Electron
- Auto-detect entrypoints with Docker support

Let me know if you'd like help with next steps! Ready to ship 🚀

[QA/local/11/11/home/devops/.qa/db/1747011390.answer ]
