#!/usr/bin/env bash

# TSM Service Discovery & Quick Start
# Discovers available services and provides easy run/save functionality

# Load TSM configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tsm_services_config.sh"

# Service discovery patterns
declare -A TSM_SERVICE_PATTERNS=(
    ["tetra"]="package.json|tetra*|README*"
    ["devpages"]="package.json|docs/|pages/|README*"
    ["tserve"]="*.html|*.js|*.css|public/|static/"
    ["node"]="package.json"
    ["python"]="requirements.txt|*.py|main.py|app.py"
    ["react"]="package.json|src/App.js|src/App.tsx"
    ["vue"]="package.json|vue.config.js|src/App.vue"
    ["next"]="package.json|next.config.js"
    ["flask"]="app.py|wsgi.py|requirements.txt"
    ["django"]="manage.py|settings.py|requirements.txt"
)

# Service startup commands
declare -A TSM_SERVICE_COMMANDS=(
    ["tetra"]="npm run dev"
    ["devpages"]="npm run dev"
    ["tserve"]="tserve start"
    ["node"]="npm start"
    ["python"]="python3 app.py"
    ["react"]="npm start"
    ["vue"]="npm run serve"
    ["next"]="npm run dev"
    ["flask"]="python3 app.py"
    ["django"]="python3 manage.py runserver"
)

# Discover what services can be run in current directory
tsm_discover() {
    local current_dir="$(pwd)"
    local found_services=()

    echo "🔍 Discovering services in: $current_dir"
    echo "================================================"

    # Check each service pattern
    for service in "${!TSM_SERVICE_PATTERNS[@]}"; do
        local patterns="${TSM_SERVICE_PATTERNS[$service]}"
        local found=false

        # Split patterns by pipe and check each one
        IFS='|' read -ra PATTERNS <<< "$patterns"
        for pattern in "${PATTERNS[@]}"; do
            if ls $pattern 2>/dev/null | grep -q .; then
                found=true
                break
            fi
        done

        if [[ "$found" == "true" ]]; then
            found_services+=("$service")
            local command="${TSM_SERVICE_COMMANDS[$service]}"
            local port="$(tsm_get_service_port "$service" "dev")"

            echo "✅ $service"
            echo "   Command: $command"
            if [[ -n "$port" ]]; then
                echo "   Port: $port"
                echo "   URL: http://localhost:$port"
            fi
            echo ""
        fi
    done

    if [[ ${#found_services[@]} -eq 0 ]]; then
        echo "❌ No known services detected in current directory"
        echo ""
        echo "Supported services:"
        for service in "${!TSM_SERVICE_PATTERNS[@]}"; do
            echo "  - $service: ${TSM_SERVICE_PATTERNS[$service]}"
        done
    else
        echo "🚀 Quick start options:"
        echo "  tsm run <service>              # Run service directly"
        echo "  tsm run <service> --save       # Run and save as TSM service"
        echo "  tsm run <service> --save-as X  # Run and save with custom name"
    fi

    return ${#found_services[@]}
}

# Quick run a discovered service
tsm_run() {
    local service_type="$1"
    local save_flag="$2"
    local custom_name="$3"

    if [[ -z "$service_type" ]]; then
        echo "Usage: tsm run <service-type> [--save] [--save-as name]"
        echo ""
        echo "Run 'tsm discover' to see available services"
        return 1
    fi

    # Verify service exists in current directory
    local patterns="${TSM_SERVICE_PATTERNS[$service_type]}"
    if [[ -z "$patterns" ]]; then
        echo "❌ Unknown service type: $service_type"
        return 1
    fi

    local found=false
    IFS='|' read -ra PATTERNS <<< "$patterns"
    for pattern in "${PATTERNS[@]}"; do
        if ls $pattern 2>/dev/null | grep -q .; then
            found=true
            break
        fi
    done

    if [[ "$found" == "false" ]]; then
        echo "❌ No $service_type service detected in current directory"
        return 1
    fi

    # Get service details
    local command="${TSM_SERVICE_COMMANDS[$service_type]}"
    local port="$(tsm_get_service_port "$service_type" "dev")"
    local current_dir="$(pwd)"

    echo "🚀 Starting $service_type service..."
    echo "   Directory: $current_dir"
    echo "   Command: $command"
    if [[ -n "$port" ]]; then
        echo "   Port: $port"
        echo "   URL: http://localhost:$port"
    fi
    echo ""

    # Save as TSM service if requested
    if [[ "$save_flag" == "--save" || "$save_flag" == "--save-as" ]]; then
        local service_name=""

        if [[ "$save_flag" == "--save-as" && -n "$custom_name" ]]; then
            service_name="$custom_name"
        else
            # Generate name from directory and service type
            local dir_name="$(basename "$current_dir")"
            service_name="${dir_name}-${service_type}-dev"
        fi

        echo "💾 Saving as TSM service: $service_name"

        # Create service definition
        mkdir -p "$TETRA_DIR/tsm/services-available"
        local service_file="$TETRA_DIR/tsm/services-available/${service_name}.tsm"

        cat > "$service_file" <<EOF
#!/usr/bin/env bash
# TSM Service: $service_name
# Auto-generated on $(date)
# Service type: $service_type
# Source directory: $current_dir

TSM_NAME="$service_name"
TSM_COMMAND="$command"
TSM_CWD="$current_dir"
TSM_PORT="$port"
TSM_ENV_FILE=""

# Auto-reload configuration
TSM_AUTO_RELOAD="true"
TSM_WATCH_PATTERNS="*.js,*.ts,*.jsx,*.tsx,*.vue,*.py,*.html,*.css,package.json"
EOF

        chmod +x "$service_file"
        echo "✅ Service saved: $service_file"
        echo ""
        echo "Management commands:"
        echo "  tsm audit enable $service_name  # Enable for auto-start"
        echo "  tsm start $service_name         # Start service"
        echo "  tsm stop $service_name          # Stop service"
        echo ""
    fi

    # Set environment variables if port is defined
    if [[ -n "$port" ]]; then
        export PORT="$port"
        export TSM_PORT="$port"
    fi

    # Change to service directory and run command
    cd "$current_dir"
    echo "▶️  Executing: $command"
    echo "   (Press Ctrl+C to stop)"
    echo ""

    # Execute the command
    eval "$command"
}

# Quick start - discover and offer to run
tsm_quickstart() {
    echo "🚀 TSM Quick Start"
    echo "=================="
    echo ""

    # Discover services
    tsm_discover
    local service_count=$?

    if [[ $service_count -eq 0 ]]; then
        echo ""
        echo "💡 Try these commands in a project directory:"
        echo "  cd ~/src/my-react-app && tsm quickstart"
        echo "  cd ~/src/my-python-app && tsm quickstart"
        return 1
    fi

    echo ""
    echo "Which service would you like to run? (or 'q' to quit)"

    # Get list of found services again
    local available_services=()
    for service in "${!TSM_SERVICE_PATTERNS[@]}"; do
        local patterns="${TSM_SERVICE_PATTERNS[$service]}"
        local found=false

        IFS='|' read -ra PATTERNS <<< "$patterns"
        for pattern in "${PATTERNS[@]}"; do
            if ls $pattern 2>/dev/null | grep -q .; then
                found=true
                break
            fi
        done

        if [[ "$found" == "true" ]]; then
            available_services+=("$service")
        fi
    done

    # Show options
    local i=1
    for service in "${available_services[@]}"; do
        echo "  $i) $service"
        i=$((i + 1))
    done

    echo ""
    read -p "Enter number (or service name): " choice

    if [[ "$choice" == "q" ]]; then
        return 0
    fi

    # Parse choice
    local selected_service=""
    if [[ "$choice" =~ ^[0-9]+$ ]]; then
        # Numeric choice
        if [[ $choice -gt 0 && $choice -le ${#available_services[@]} ]]; then
            selected_service="${available_services[$((choice - 1))]}"
        fi
    else
        # Service name choice
        for service in "${available_services[@]}"; do
            if [[ "$service" == "$choice" ]]; then
                selected_service="$service"
                break
            fi
        done
    fi

    if [[ -z "$selected_service" ]]; then
        echo "❌ Invalid choice: $choice"
        return 1
    fi

    # Ask if they want to save
    echo ""
    read -p "Save as TSM service for future use? (y/N): " save_choice

    if [[ "$save_choice" =~ ^[Yy] ]]; then
        tsm_run "$selected_service" "--save"
    else
        tsm_run "$selected_service"
    fi
}

# List saved services and their status
tsm_list_services() {
    echo "📋 TSM Services"
    echo "==============="
    echo ""

    local available_dir="$TETRA_DIR/tsm/services-available"
    local enabled_dir="$TETRA_DIR/tsm/services-enabled"

    if [[ ! -d "$available_dir" ]]; then
        echo "No services directory found. Run 'tsm audit init' to initialize."
        return 1
    fi

    local count=0
    for service_file in "$available_dir"/*.tsm; do
        [[ -f "$service_file" ]] || continue

        local service_name=$(basename "$service_file" .tsm)
        local enabled="❌"
        local running="⏹️"
        local port=""
        local command=""
        local directory=""

        # Check if enabled
        if [[ -L "$enabled_dir/$service_name.tsm" ]]; then
            enabled="✅"
        fi

        # Check if running
        if tetra_tsm_is_running "$service_name" 2>/dev/null; then
            running="🚀"
        fi

        # Read service details
        if [[ -f "$service_file" ]]; then
            port=$(grep "TSM_PORT=" "$service_file" | cut -d'=' -f2 | tr -d '"' | head -1)
            command=$(grep "TSM_COMMAND=" "$service_file" | cut -d'=' -f2 | tr -d '"' | head -1)
            directory=$(grep "TSM_CWD=" "$service_file" | cut -d'=' -f2 | tr -d '"' | head -1)
        fi

        echo "$running $enabled $service_name"
        if [[ -n "$port" ]]; then
            echo "    Port: $port - http://localhost:$port"
        fi
        if [[ -n "$directory" ]]; then
            echo "    Dir:  $directory"
        fi
        if [[ -n "$command" ]]; then
            echo "    Cmd:  $command"
        fi
        echo ""

        count=$((count + 1))
    done

    if [[ $count -eq 0 ]]; then
        echo "No services found. Run 'tsm quickstart' to discover and save services."
    else
        echo "Legend: 🚀=running ⏹️=stopped ✅=enabled ❌=disabled"
        echo ""
        echo "Quick commands:"
        echo "  tsm quickstart         # Discover services in current directory"
        echo "  tsm audit enable NAME  # Enable service for auto-start"
        echo "  tsm start NAME         # Start a service"
        echo "  tsm stop NAME          # Stop a service"
    fi
}

# Main command handler
case "${1:-discover}" in
    "discover"|"")
        tsm_discover
        ;;
    "run")
        tsm_run "$2" "$3" "$4"
        ;;
    "quickstart"|"quick")
        tsm_quickstart
        ;;
    "list"|"ls")
        tsm_list_services
        ;;
    "help")
        echo "TSM Service Discovery & Quick Start"
        echo ""
        echo "Usage: tsm <command> [arguments]"
        echo ""
        echo "Commands:"
        echo "  discover              - Discover services in current directory (default)"
        echo "  run <type> [--save]   - Run a discovered service"
        echo "  quickstart            - Interactive service discovery and startup"
        echo "  list                  - List all saved TSM services"
        echo "  help                  - Show this help"
        echo ""
        echo "Examples:"
        echo "  cd ~/src/my-react-app"
        echo "  tsm discover          # See what can be run"
        echo "  tsm run react --save  # Run and save React app"
        echo "  tsm quickstart        # Interactive mode"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run 'tsm help' for usage information"
        exit 1
        ;;
esac