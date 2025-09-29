#!/usr/bin/env bash

# TServe - Single Test Server for Development
# One shared test server with symlink management for multiple project directories

# Load TSM configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tsm_services_config.sh"

# TServe configuration
TSERVE_DIR="$TETRA_DIR/tserve"
TSERVE_SERVED_DIR="$TSERVE_DIR/served"
TSERVE_CONFIG_FILE="$TSERVE_DIR/tserve.conf"
TSERVE_DEFAULT_PORT="5500"

# Initialize tserve directory structure
tserve_init() {
    mkdir -p "$TSERVE_DIR"
    mkdir -p "$TSERVE_SERVED_DIR"

    # Create index.html if it doesn't exist
    if [[ ! -f "$TSERVE_SERVED_DIR/index.html" ]]; then
        cat > "$TSERVE_SERVED_DIR/index.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>TServe - Single Test Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 2em; }
        .directory { margin: 1em 0; padding: 1em; border: 1px solid #ddd; border-radius: 4px; }
        .directory h3 { margin-top: 0; color: #333; }
        .directory a { color: #0066cc; text-decoration: none; }
        .directory a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🧪 TServe - Single Test Server</h1>
    <p>Welcome to your shared test server. Below are the directories currently being served:</p>

    <div id="directories">
        <!-- Directories will be listed here -->
    </div>

    <hr>
    <p><em>Add directories with: <code>tserve add &lt;path&gt;</code></em></p>

    <script>
        // Auto-refresh directory list
        fetch('/api/directories')
            .then(response => response.json())
            .then(directories => {
                const container = document.getElementById('directories');
                container.innerHTML = directories.map(dir =>
                    \`<div class="directory">
                        <h3><a href="/\${dir.name}/">\${dir.name}/</a></h3>
                        <p>Source: \${dir.source}</p>
                    </div>\`
                ).join('');
            })
            .catch(() => {
                // Fallback if API not available
                document.getElementById('directories').innerHTML =
                    '<p><em>Directory listing not available - check served/ folder for symlinks</em></p>';
            });
    </script>
</body>
</html>
EOF
    fi

    # Create default config
    if [[ ! -f "$TSERVE_CONFIG_FILE" ]]; then
        cat > "$TSERVE_CONFIG_FILE" <<EOF
# TServe Configuration
PORT=$TSERVE_DEFAULT_PORT
BIND_ADDRESS=127.0.0.1
AUTO_INDEX=true
EOF
    fi

    echo "✅ TServe initialized at $TSERVE_DIR"
}

# Add a directory to be served
tserve_add() {
    local source_path="$1"
    local link_name="$2"

    if [[ -z "$source_path" ]]; then
        echo "Usage: tserveadd <path> [link-name]"
        echo "   or: tserveadd . (to add current directory)"
        return 1
    fi

    # Resolve full path
    if [[ "$source_path" == "." ]]; then
        source_path="$(pwd)"
    else
        source_path="$(realpath "$source_path" 2>/dev/null || echo "$source_path")"
    fi

    if [[ ! -d "$source_path" ]]; then
        echo "❌ Directory does not exist: $source_path"
        return 1
    fi

    # Auto-generate link name if not provided
    if [[ -z "$link_name" ]]; then
        link_name="$(basename "$source_path")"

        # Handle special cases
        if [[ "$link_name" == "." ]]; then
            link_name="$(basename "$(dirname "$source_path")")"
        fi

        # Sanitize name
        link_name="${link_name// /_}"
        link_name="${link_name//[^a-zA-Z0-9_-]/}"
    fi

    local link_path="$TSERVE_SERVED_DIR/$link_name"

    # Check if link already exists
    if [[ -L "$link_path" ]]; then
        local existing_target="$(readlink "$link_path")"
        if [[ "$existing_target" == "$source_path" ]]; then
            echo "✅ Directory already added: $link_name → $source_path"
            return 0
        else
            echo "⚠️  Link name already exists: $link_name → $existing_target"
            echo "    Use a different name or remove existing link first"
            return 1
        fi
    fi

    # Create symlink
    if ln -s "$source_path" "$link_path"; then
        echo "✅ Added directory: $link_name → $source_path"
        echo "    URL: http://localhost:$(tserve_get_port)/$link_name/"
    else
        echo "❌ Failed to create symlink"
        return 1
    fi
}

# Remove a served directory
tserve_remove() {
    local link_name="$1"

    if [[ -z "$link_name" ]]; then
        echo "Usage: tserveremove <link-name>"
        return 1
    fi

    local link_path="$TSERVE_SERVED_DIR/$link_name"

    if [[ ! -L "$link_path" ]]; then
        echo "❌ Link does not exist: $link_name"
        return 1
    fi

    rm "$link_path"
    echo "✅ Removed directory: $link_name"
}

# List served directories
tserve_list() {
    echo "📋 TWeb Served Directories:"
    echo ""

    local count=0
    if [[ -d "$TSERVE_SERVED_DIR" ]]; then
        for link_path in "$TSERVE_SERVED_DIR"/*; do
            [[ -L "$link_path" ]] || continue
            local link_name="$(basename "$link_path")"
            local target="$(readlink "$link_path")"
            count=$((count + 1))

            if [[ -d "$target" ]]; then
                echo "  ✅ $link_name → $target"
                echo "      URL: http://localhost:$(tserve_get_port)/$link_name/"
            else
                echo "  ❌ $link_name → $target (broken)"
            fi
        done
    fi

    if [[ $count -eq 0 ]]; then
        echo "  (No directories being served)"
        echo ""
        echo "Add directories with: tserveadd <path>"
    fi

    echo ""
    echo "Server URL: http://localhost:$(tserve_get_port)/"
}

# Get configured port
tserve_get_port() {
    if [[ -f "$TSERVE_CONFIG_FILE" ]]; then
        grep "^PORT=" "$TSERVE_CONFIG_FILE" | cut -d'=' -f2 || echo "$TSERVE_DEFAULT_PORT"
    else
        echo "$TSERVE_DEFAULT_PORT"
    fi
}

# Start the web server
tserve_start() {
    echo "🚀 Starting TServe Enhanced..."
    exec "$SCRIPT_DIR/tserve_enhanced.sh" serve --auto --cors --live
}

# Generate service definition
tserve_generate_service() {
    local port="${1:-$TSERVE_DEFAULT_PORT}"
    local service_name="tserve-$port"

    echo "Generating service definition for $service_name (port $port)"

    # Create services directories if they don't exist
    mkdir -p "$TETRA_DIR/tsm/services-available"
    mkdir -p "$TETRA_DIR/tsm/services-enabled"

    local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

    cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Generated on $(date)

TSM_NAME="$service_name"
TSM_COMMAND="$SCRIPT_DIR/tserve_enhanced.sh serve --cors --live --port $port"
TSM_CWD="$TSERVE_SERVED_DIR"
TSM_PORT="$port"
TSM_ENV_FILE=""

# TWeb-specific configuration
TSERVE_DIR="$TSERVE_DIR"
TSERVE_SERVED_DIR="$TSERVE_SERVED_DIR"
TSERVE_CONFIG_FILE="$TSERVE_CONFIG_FILE"

# Initialize TWeb on service start
if [[ ! -d "\$TSERVE_SERVED_DIR" ]]; then
    source "$SCRIPT_DIR/tserve.sh"
    tserve_init
fi
EOF

    chmod +x "$service_file"
    echo "✅ Service definition created: $service_file"
    echo ""
    echo "To enable: tsm audit enable $service_name"
    echo "To start:  tsm start $service_name"
}

# Main command handler
case "${1:-help}" in
    "init")
        tserve_init
        ;;
    "add")
        tserve_add "$2" "$3"
        ;;
    "remove"|"rm")
        tserve_remove "$2"
        ;;
    "list"|"ls")
        tserve_list
        ;;
    "start"|"serve")
        # Route to enhanced server with all arguments
        shift
        exec "$SCRIPT_DIR/tserve_enhanced.sh" serve "$@"
        ;;
    "service")
        tserve_generate_service "$2"
        ;;
    "status")
        exec "$SCRIPT_DIR/tserve_enhanced.sh" status
        ;;
    "cleanup")
        exec "$SCRIPT_DIR/tserve_enhanced.sh" cleanup
        ;;
    "help"|"")
        echo "TServe - Single Test Server for Development"
        echo ""
        echo "Usage: tserve <command> [arguments]"
        echo ""
        echo "Commands:"
        echo "  init                    - Initialize TServe directory structure"
        echo "  add <path> [name]      - Add directory to be served (use '.' for current)"
        echo "  remove <name>          - Remove served directory"
        echo "  list                   - List served directories"
        echo "  serve [options]        - Start enhanced web server (see --help)"
        echo "  status                 - Show running servers"
        echo "  cleanup                - Clean up hosts entries and temp files"
        echo "  service [port]         - Generate TSM service definition"
        echo "  help                   - Show this help"
        echo ""
        echo "Examples:"
        echo "  tserve init              # Initialize TServe"
        echo "  tserve add .             # Add current directory"
        echo "  tserve add ~/src/myapp   # Add specific directory"
        echo "  tserve list              # List served directories"
        echo "  tserve serve --cors --live   # Enhanced server with CORS and live reload"
        echo "  tserve serve --https --name myapp  # HTTPS server with custom hostname"
        echo "  tserve service 5500      # Generate service for port 5500"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run 'tserve help' for usage information"
        exit 1
        ;;
esac