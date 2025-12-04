#!/usr/bin/env bash
pb() {
    local action=$1
    shift

    # If no arguments provided, show quick help
    if [ -z "$action" ]; then
        echo "Usage: pb <command>"
        echo "Commands: ls|(re)start|stop|kill|logs|ports|help"
        echo "Example: pb ls"
        #pb ls
        return 0
    fi

    case "$action" in
        start)
            local script=$1
            local extra=$2
            if [ -z "$script" ]; then
                echo "Usage: pb start <path/to/scriptname.sh> [custom_name]"
                return 1
            fi
            
            # Use filename as default name if no extra name provided
            local script_basename=$(basename "$script" .sh)
            local process_name="${extra:-$script_basename}"
            
            # Check for PORT in environment first, then in script file
            if [ -z "$PORT" ]; then
                # Try to find PORT= or export PORT= in the script
                FOUND_PORT=$(grep -E "^(export )?PORT=" "$script" | head -n 1)
                if [ -n "$FOUND_PORT" ]; then
                    # Handle both PORT=value and export PORT=value formats
                    eval "$FOUND_PORT"
                    echo "Found and using PORT definition from script: $FOUND_PORT"
                else
                    echo "Error: PORT environment variable is not set and no PORT= or export PORT= found in script."
                    return 1
                fi
            fi
            # Start the script with PM2, using the process name and port
            pm2 start "$script" --name "$process_name-$PORT"
            ;;
            
        ls)
            echo "PM2_HOME=$PM2_HOME"
	    pm2 ls
            ;;
            
        stop)
            if [ $# -eq 0 ]; then
                echo "Usage: pb stop <process1 process2 ... | *>"
                return 1
            fi
            if [ "$1" = "*" ]; then
                pm2 stop all
            else
                for process in "$@"; do
                    pm2 stop "$process"
                done
            fi
            ;;
            
        delete|del|kill)
            if [ $# -eq 0 ]; then
                echo "Usage: pb delete|kill <process1 process2 ... | *>"
                return 1
            fi
            if [ "$1" = "*" ]; then
                pm2 delete all
            else
                for process in "$@"; do
                    pm2 delete "$process"
                done
            fi
            ;;
            
        logs)
            if [ $# -eq 0 ]; then
                echo "Usage: pb logs <process1 process2 ... | *>"
                return 1
            fi
            if [ "$1" = "*" ]; then
                pm2 logs
            else
                for process in "$@"; do
                    pm2 logs "$process"
                done
            fi
            ;;
            
        restart)
            if [ $# -eq 0 ]; then
                echo "Usage: pb restart <process1 process2 ... | *>"
                return 1
            fi
            if [ "$1" = "*" ]; then
                pm2 restart all
            else
                for process in "$@"; do
                    pm2 restart "$process"
                done
            fi
            ;;
            
        ports)
            # List all running PM2 processes with their names and ports
            pm2 jlist | jq -r '.[] | select(.pm2_env.status == "online") | "\(.name)"' | grep -E ".*-[0-9]+$" | while read process; do
                port=$(echo "$process" | grep -oE "[0-9]+$")
                name=$(echo "$process" | sed "s/-$port$//")
                echo "Process: $name, Port: $port"
            done
            ;;
            
        help)
            cat <<EOF
PM2 Port Process Manager Helper

Usage:
  pb start <path/to/scriptname.sh> [custom_name] - Start a script with PM2
  pb stop <process1 process2 ... | *>            - Stop processes
  pb delete|kill <process1 process2 ... | *>     - Delete processes
  pb restart <process1 process2 ... | *>         - Restart processes
  pb ls                                          - List all PM2 processes
  pb logs <process1 process2 ... | *>            - Show logs for processes
  pb ports                                       - List all running scripts with ports
  pb help                                        - Show this help message

Examples:
  pb start path/to/scriptname.sh                 - Start script with default name (scriptname-PORT)
  pb start path/to/scriptname.sh myapp           - Start script with custom name (myapp-PORT)
  pb stop scriptname-8080                        - Stop process
  pb stop *                                      - Stop all processes
  pb kill *                                      - Delete all processes
  pb logs scriptname-8080                        - Show logs for process

PORT Detection:
  The script will look for PORT in the following order:
  1. Environment variable: PORT=8080
  2. Script file: PORT=8080 or export PORT=8080
EOF
            ;;
            
        *)
            #pb list
            #echo "Unknown command: $action"
            echo "Use 'pb help' for usage information"
            return 0
            ;;
    esac
}
