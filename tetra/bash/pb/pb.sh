#!/bin/bash
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
                echo "Usage: pb start <path/to/scriptname.sh>"
                return 1
            fi
            if [ -z "$PORT" ]; then
                # Try to find PORT= in the script
                FOUND_PORT=$(grep "^PORT=" "$script" | head -n 1)
                if [ -n "$FOUND_PORT" ]; then
                    eval "$FOUND_PORT"
                    echo "Found and using PORT definition from script: $FOUND_PORT"
                else
                    echo "Error: PORT environment variable is not set and no PORT= found in script."
                    return 1
                fi
            fi
            # Start the script with PM2, using the script name and port for the process name
            pm2 start "$script" --name "$extra-$PORT"
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
            # List all running scripts with their ports
            pm2 ls | grep "$(basename "$script" .sh)-" | awk '{print $2, $8}' | sed 's/$(basename "$script" .sh)-/Port: /'
            ;;
            
        help)
            cat <<EOF
PM2 Port Process Manager Helper

Usage:
  pb start <path/to/scriptname.sh>       - Start a script with PM2
  pb stop <process1 process2 ... | *>    - Stop processes
  pb delete|kill <process1 process2 ... | *> - Delete processes
  pb restart <process1 process2 ... | *> - Restart processes
  pb ls                                  - List all PM2 processes
  pb logs <process1 process2 ... | *>    - Show logs for processes
  pb ports                               - List all running scripts with ports
  pb help                                - Show this help message

Examples:
  pb start path/to/scriptname.sh         - Start script with PM2
  pb stop scriptname-8080                - Stop process
  pb stop *                              - Stop all processes
  pb kill *                              - Delete all processes
  pb logs scriptname-8080                - Show logs for process
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
