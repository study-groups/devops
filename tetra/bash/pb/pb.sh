#!/bin/bash

pb() {
  local action=$1
  shift

  # If no action provided
  if [ -z "$action" ]; then
    echo "Usage: pb <command>"
    echo "Commands: ls | start | restart | stop | kill | logs | ports | help"
    echo "Example: pb ls"
    return 0
  fi

  case "$action" in
    start)
      local script=$1
      if [ -z "$script" ]; then
        echo "Usage: pb start <path/to/scriptname.sh>"
        return 1
      fi

      # Extract app name from filename
      local appname=$(basename "$script" .sh)

      if [ -z "$PORT" ]; then
        # Try to get PORT from inside the script
        local found_port=$(grep "^PORT=" "$script" | head -n 1)
        if [ -n "$found_port" ]; then
          eval "$found_port"
          echo "Found and using PORT from script: $PORT"
        else
          echo "Error: PORT environment variable is not set and no PORT= found in script."
          return 1
        fi
      fi

      pm2 start "$script" --name "${appname}-${PORT}"
      ;;

    ls)
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
      pm2 ls | awk '{print $2, $8}' | grep -E '.*-[0-9]{4,5}' | sed 's/-/ : /'
      ;;

    help)
      cat <<EOF
PM2 Port-Based Process Manager Helper

Usage:
  pb start <path/to/scriptname.sh>       Start a script with PM2 using basename and PORT
  pb stop <process1 ... | *>             Stop processes
  pb delete|kill <process1 ... | *>      Delete processes
  pb restart <process1 ... | *>          Restart processes
  pb ls                                  List all PM2 processes
  pb logs <process1 ... | *>             Show logs for processes
  pb ports                               List PM2 processes and their ports
  pb help                                Show this help message

Examples:
  pb start ./myapp.sh                    Starts myapp.sh with name myapp-PORT
  pb stop myapp-8080                     Stops specific process
  pb stop *                              Stops all processes
  pb kill *                              Deletes all processes
  pb logs myapp-8080                     Logs for a specific process

EOF
      ;;

    *)
      echo "Unknown command: $action"
      echo "Use 'pb help' for usage information"
      return 1
      ;;
  esac
}

