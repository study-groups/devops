#!/usr/bin/env bash

# TServe Enhanced - Advanced Development Test Server
# Features: Dynamic ports, /etc/hosts, CORS, live reload, HTTPS, enhanced indexing

set -euo pipefail

# Configuration
TSERVE_PORT_RANGE_START=5500
TSERVE_PORT_RANGE_END=5599
TSERVE_DEFAULT_NAME="devserver"
TSERVE_HOSTS_BACKUP="/tmp/tserve_hosts_backup"
TSERVE_CERT_DIR="$HOME/.tserve/certs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Logging
log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_success() { echo -e "${CYAN}[SUCCESS]${NC} $*"; }

# Find next available port in range
find_available_port() {
    local start_port=${1:-$TSERVE_PORT_RANGE_START}
    local end_port=${2:-$TSERVE_PORT_RANGE_END}

    for port in $(seq $start_port $end_port); do
        if ! lsof -i :$port >/dev/null 2>&1; then
            echo $port
            return 0
        fi
    done

    log_error "No available ports in range $start_port-$end_port"
    return 1
}

# Generate friendly hostname from directory name
generate_hostname() {
    local name="$1"
    local dir_name="$(basename "$(pwd)")"

    # Clean up name for hostname use
    local hostname="${name:-$dir_name}"
    hostname=$(echo "$hostname" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')

    # Ensure it doesn't conflict with common domains
    case "$hostname" in
        "localhost"|"local"|"dev"|"test") hostname="${hostname}-dev" ;;
    esac

    echo "${hostname}.local"
}

# Backup /etc/hosts
backup_hosts() {
    if [[ ! -f "$TSERVE_HOSTS_BACKUP" ]]; then
        sudo cp /etc/hosts "$TSERVE_HOSTS_BACKUP"
        log_info "Backed up /etc/hosts to $TSERVE_HOSTS_BACKUP"
    fi
}

# Add entry to /etc/hosts
add_hosts_entry() {
    local hostname="$1"

    if ! grep -q "127.0.0.1.*${hostname}" /etc/hosts; then
        backup_hosts
        echo "127.0.0.1 $hostname # tserve" | sudo tee -a /etc/hosts > /dev/null
        log_success "Added $hostname to /etc/hosts"
    else
        log_info "Hostname $hostname already exists in /etc/hosts"
    fi
}

# Remove tserve entries from /etc/hosts
cleanup_hosts() {
    if [[ -f /etc/hosts ]]; then
        sudo sed -i '' '/# tserve$/d' /etc/hosts 2>/dev/null || true
        log_info "Cleaned up tserve entries from /etc/hosts"
    fi
}

# Generate self-signed certificate
generate_cert() {
    local hostname="$1"
    local cert_dir="$TSERVE_CERT_DIR/$hostname"

    mkdir -p "$cert_dir"

    if [[ ! -f "$cert_dir/server.crt" || ! -f "$cert_dir/server.key" ]]; then
        log_info "Generating self-signed certificate for $hostname..."

        # Create certificate configuration
        cat > "$cert_dir/server.conf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
CN=$hostname

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = $hostname
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

        # Generate certificate
        openssl req -newkey rsa:2048 -nodes -keyout "$cert_dir/server.key" -x509 -days 365 -out "$cert_dir/server.crt" -config "$cert_dir/server.conf" -extensions v3_req 2>/dev/null

        log_success "Certificate generated: $cert_dir/server.crt"
    fi

    echo "$cert_dir"
}

# Create enhanced Python server with features
create_enhanced_server() {
    local port="$1"
    local hostname="$2"
    local enable_cors="$3"
    local enable_https="$4"
    local enable_live_reload="$5"
    local cert_dir="$6"

    cat > "/tmp/tserve_${port}.py" <<EOF
#!/usr/bin/env python3
import os
import sys
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import ssl
import threading
import time
from pathlib import Path

class EnhancedHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.enable_cors = ${enable_cors}
        self.enable_live_reload = ${enable_live_reload}
        super().__init__(*args, **kwargs)

    def end_headers(self):
        if self.enable_cors:
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def list_directory(self, path):
        """Enhanced directory listing with preview and actions"""
        try:
            file_list = os.listdir(path)
        except OSError:
            self.send_error(404, "No permission to list directory")
            return None

        file_list.sort(key=lambda a: a.lower())

        displaypath = self.path.rstrip('/')
        title = f'Directory listing for {displaypath}'

        # Enhanced HTML template
        html = f'''<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .server-info {{ font-size: 14px; opacity: 0.9; margin-top: 5px; }}
        .files {{ padding: 20px; }}
        .file-item {{ display: flex; align-items: center; padding: 12px 16px; border-radius: 6px; margin-bottom: 8px; transition: all 0.2s; }}
        .file-item:hover {{ background: #f1f3f4; transform: translateX(4px); }}
        .file-icon {{ width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0; }}
        .file-info {{ flex: 1; min-width: 0; }}
        .file-name {{ font-weight: 500; color: #1a73e8; text-decoration: none; }}
        .file-name:hover {{ text-decoration: underline; }}
        .file-meta {{ font-size: 12px; color: #5f6368; margin-top: 2px; }}
        .file-actions {{ display: flex; gap: 8px; }}
        .btn {{ padding: 4px 8px; font-size: 12px; border: 1px solid #dadce0; border-radius: 4px; background: white; color: #3c4043; text-decoration: none; }}
        .btn:hover {{ background: #f8f9fa; }}
        .directory {{ background: #e8f0fe; }}
        .preview-panel {{ position: fixed; top: 20px; right: 20px; width: 300px; max-height: 400px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 16px; display: none; }}
        .live-indicator {{ position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 8px 12px; border-radius: 20px; font-size: 12px; display: none; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 TServe Enhanced</h1>
            <div class="server-info">
                Serving: {os.getcwd()}<br>
                URL: http{'s' if ${enable_https} else ''}://{hostname}:{port}/
            </div>
        </div>
        <div class="files">
'''

        # Add parent directory link
        if displaypath != '/':
            html += '''
            <div class="file-item">
                <div class="file-icon">📁</div>
                <div class="file-info">
                    <a href="../" class="file-name">📂 Parent Directory</a>
                </div>
            </div>
            '''

        # List files and directories
        for name in file_list:
            if name.startswith('.'):
                continue

            fullname = os.path.join(path, name)
            linkname = name
            if os.path.isdir(fullname):
                linkname = name + "/"

            stat_result = os.stat(fullname)
            size = stat_result.st_size
            mtime = time.strftime('%Y-%m-%d %H:%M', time.localtime(stat_result.st_mtime))

            if os.path.isdir(fullname):
                icon = "📁"
                size_str = "Directory"
                item_class = "directory"
            else:
                # Get file icon based on extension
                ext = Path(name).suffix.lower()
                icon_map = {
                    '.html': '🌐', '.css': '🎨', '.js': '⚡', '.json': '📋',
                    '.py': '🐍', '.md': '📝', '.txt': '📄', '.pdf': '📕',
                    '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
                    '.mp4': '🎬', '.mp3': '🎵', '.zip': '📦'
                }
                icon = icon_map.get(ext, '📄')
                size_str = f"{size:,} bytes" if size < 1024 else f"{size/1024:.1f} KB" if size < 1024*1024 else f"{size/(1024*1024):.1f} MB"
                item_class = ""

            html += f'''
            <div class="file-item {item_class}">
                <div class="file-icon">{icon}</div>
                <div class="file-info">
                    <a href="{linkname}" class="file-name">{name}</a>
                    <div class="file-meta">{size_str} • Modified {mtime}</div>
                </div>
                <div class="file-actions">
                    <a href="{linkname}" class="btn" target="_blank">Open</a>
                    <button class="btn" onclick="copyUrl('{linkname}')">Copy URL</button>
                </div>
            </div>
            '''

        html += '''
        </div>
    </div>

    <div class="preview-panel" id="previewPanel">
        <div id="previewContent"></div>
    </div>
'''

        if self.enable_live_reload:
            html += '''
    <div class="live-indicator" id="liveIndicator">🔄 Live Reload</div>
    <script>
        // Live reload functionality
        let lastCheck = Date.now();
        function checkForUpdates() {
            fetch(window.location.href + '?_check=' + Date.now(), {
                method: 'HEAD'
            }).then(response => {
                const lastModified = new Date(response.headers.get('Last-Modified')).getTime();
                if (lastModified > lastCheck) {
                    document.getElementById('liveIndicator').style.display = 'block';
                    setTimeout(() => window.location.reload(), 500);
                }
            }).catch(() => {});
        }
        setInterval(checkForUpdates, 2000);
    </script>
    '''

        html += '''
    <script>
        function copyUrl(filename) {
            const url = window.location.href + filename;
            navigator.clipboard.writeText(url).then(() => {
                alert('URL copied to clipboard: ' + url);
            });
        }
    </script>
</body>
</html>
'''

        encoded = html.encode('utf-8', 'surrogateescape')
        f = BytesIO()
        f.write(encoded)
        f.seek(0)
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        return f

# Setup server
try:
    from io import BytesIO

    handler = EnhancedHandler
    httpd = HTTPServer(('0.0.0.0', ${port}), handler)

    # Configure HTTPS if enabled
    if ${enable_https}:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain('${cert_dir}/server.crt', '${cert_dir}/server.key')
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

    print(f"🚀 TServe Enhanced running on http{'s' if ${enable_https} else ''}://${hostname}:${port}/")
    print(f"📁 Serving: {os.getcwd()}")
    print(f"🌐 Access via: http{'s' if ${enable_https} else ''}://${hostname}:${port}/")
    if ${enable_cors}:
        print("🔓 CORS enabled for all origins")
    if ${enable_live_reload}:
        print("🔄 Live reload enabled")
    print("Press Ctrl+C to stop")

    httpd.serve_forever()

except KeyboardInterrupt:
    print("\\n⏹️  Server stopped")
except Exception as e:
    print(f"❌ Server error: {e}")
    sys.exit(1)
EOF

    echo "/tmp/tserve_${port}.py"
}

# Enhanced serve command
tserve_serve() {
    local port=""
    local hostname=""
    local enable_cors="False"
    local enable_https="False"
    local enable_live_reload="False"
    local custom_name=""
    local auto_mode="False"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --port) port="$2"; shift 2 ;;
            --name) custom_name="$2"; shift 2 ;;
            --cors) enable_cors="True"; shift ;;
            --https) enable_https="True"; shift ;;
            --live|--reload) enable_live_reload="True"; shift ;;
            --auto) auto_mode="True"; shift ;;
            *) shift ;;
        esac
    done

    # Find port if not specified
    if [[ -z "$port" ]]; then
        port=$(find_available_port)
        [[ $? -eq 0 ]] || exit 1
    fi

    # Generate hostname
    hostname=$(generate_hostname "$custom_name")

    # Add to /etc/hosts
    add_hosts_entry "$hostname"

    # Generate SSL certificate if HTTPS enabled
    local cert_dir=""
    if [[ "$enable_https" == "True" ]]; then
        cert_dir=$(generate_cert "$hostname")
    fi

    # Create and run enhanced server
    local server_script=$(create_enhanced_server "$port" "$hostname" "$enable_cors" "$enable_https" "$enable_live_reload" "$cert_dir")

    # Setup cleanup on exit
    trap 'cleanup_server' EXIT INT TERM

    log_info "Starting TServe Enhanced..."
    log_info "Directory: $(pwd)"
    log_info "Hostname: $hostname"
    log_info "Port: $port"
    [[ "$enable_cors" == "True" ]] && log_info "CORS: Enabled"
    [[ "$enable_https" == "True" ]] && log_info "HTTPS: Enabled"
    [[ "$enable_live_reload" == "True" ]] && log_info "Live Reload: Enabled"

    echo
    log_success "🚀 TServe URL: http${enable_https:+s}://$hostname:$port/"
    echo

    python3 "$server_script"
}

# Cleanup function
cleanup_server() {
    log_info "Cleaning up..."
    rm -f /tmp/tserve_*.py
    if [[ "$1" != "--keep-hosts" ]]; then
        cleanup_hosts
    fi
}

# Show status of running servers
tserve_status() {
    echo "🔍 TServe Status:"
    echo

    local found=false
    for port in $(seq $TSERVE_PORT_RANGE_START $TSERVE_PORT_RANGE_END); do
        if lsof -i :$port >/dev/null 2>&1; then
            local pid=$(lsof -ti :$port)
            local cmd=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            if [[ "$cmd" == *"python"* ]]; then
                echo "✅ Port $port - PID $pid - http://localhost:$port/"
                found=true
            fi
        fi
    done

    if [[ "$found" == "false" ]]; then
        echo "No TServe instances running"
    fi

    echo
    echo "📝 /etc/hosts entries:"
    grep "# tserve" /etc/hosts 2>/dev/null || echo "No tserve entries found"
}

# Main command router
main() {
    case "${1:-help}" in
        "serve")
            shift
            tserve_serve "$@"
            ;;
        "status")
            tserve_status
            ;;
        "cleanup")
            cleanup_server
            log_success "Cleanup completed"
            ;;
        "help"|"")
            echo "TServe Enhanced - Advanced Development Test Server"
            echo
            echo "Usage: tserve <command> [options]"
            echo
            echo "Commands:"
            echo "  serve [options]        Start enhanced development server"
            echo "  status                 Show running servers"
            echo "  cleanup                Clean up hosts entries and temp files"
            echo "  help                   Show this help"
            echo
            echo "Serve Options:"
            echo "  --port <port>          Specify port (auto-detected if not provided)"
            echo "  --name <name>          Custom hostname (default: directory name)"
            echo "  --cors                 Enable CORS headers"
            echo "  --https                Enable HTTPS with self-signed certificate"
            echo "  --live                 Enable live reload"
            echo "  --auto                 Auto-configure for development"
            echo
            echo "Examples:"
            echo "  tserve serve                    # Basic server with auto port"
            echo "  tserve serve --name myapp       # Custom hostname: myapp.local"
            echo "  tserve serve --cors --live      # With CORS and live reload"
            echo "  tserve serve --https --name api # HTTPS server: https://api.local:5500/"
            echo "  tserve serve --auto             # All development features enabled"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Run 'tserve help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"