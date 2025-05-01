#!/bin/bash

# Get the directory containing this script
SCRIPT_DIR=$(dirname $(readlink -f ${0}))

# Ensure we're in the right directory context
cd $SCRIPT_DIR

# Log with timestamps and prefixes
log() {
    echo "[$(date '+%H:%M:%S')] [USERS] $1"
}

error() {
    echo "[$(date '+%H:%M:%S')] [USERS ERROR] $1" >&2
}

# --- Check for PD_DIR ---
if [ -z "$PD_DIR" ]; then
    error "PD_DIR environment variable is not set."
    error "Please set PD_DIR to the PData directory containing users.csv"
    exit 1
elif [ ! -d "$PD_DIR" ]; then
    error "PD_DIR directory does not exist: $PD_DIR"
    exit 1
fi

# --- Export PD_DIR for Node.js scripts ---
export PD_DIR 

# Construct the expected path to users.csv for checks/logging
USERS_CSV_PATH="$PD_DIR/users.csv"

log "Using PD_DIR: $PD_DIR"
log "Expecting users file at: $USERS_CSV_PATH"

# Define the path to the manageUsers Node.js script
MANAGE_USERS_SCRIPT="./server/utils/manageUsers.js" # Corrected relative path

if [ ! -f "$MANAGE_USERS_SCRIPT" ]; then
    error "Cannot find manageUsers script at: $MANAGE_USERS_SCRIPT"
    error "Ensure you are running usermgr.sh from the project root."
    exit 1
fi

# Function to show summary
show_summary() {
    log "Environment Summary:"
    log "PD_DIR = $PD_DIR"
    log "Users file = $USERS_CSV_PATH"
    if [ -f "$USERS_CSV_PATH" ]; then
         log "Users file exists."
    else
         log "Users file does NOT exist."
    fi
    log "Current users in file:"
    list_users # Call list_users to show content
}

# Function to add a user
add_user() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        error "Usage: $0 add <username> <password>"
        exit 1
    fi
    log "Adding user: $1"
    node "$MANAGE_USERS_SCRIPT" add "$1" "$2"
}

# Function to list users
list_users() {
    log "Listing users"
    node "$MANAGE_USERS_SCRIPT" list
}

# Function to delete a user
delete_user() {
    if [ -z "$1" ]; then
        error "Usage: $0 delete <username>"
        exit 1
    fi
    log "Deleting user: $1"
    node "$MANAGE_USERS_SCRIPT" delete "$1"
}

# Function to update a user's password
update_user() {
     if [ -z "$1" ] || [ -z "$2" ]; then
        error "Usage: $0 update <username> <new_password>"
        exit 1
    fi
    log "Updating password for user: $1"
    node "$MANAGE_USERS_SCRIPT" update "$1" "$2"
}

# Function to show help
show_help() {
    echo "Usage: $0 <command> [args]"
    echo
    echo "Manages users stored in users.csv within the directory specified by PD_DIR."
    echo
    echo "Commands:"
    echo "  add <username> <password>    Add a new user"
    echo "  update <username> <password> Update an existing user's password"
    echo "  list                         List all users"
    echo "  delete <username>            Delete a user"
    # echo "  interactive                  Start interactive mode" # Optional: keep if manageUsers.js supports it
    echo "  summary                      Show environment summary"
    echo "  help                         Show this help"
    echo
    echo "Environment:"
    echo "  PD_DIR (Required)            Path to PData directory containing users.csv"
    echo
    echo "Examples:"
    echo "  export PD_DIR=/path/to/pdata"
    echo "  $0 add john secret123       Add user 'john' with password 'secret123'"
    echo "  $0 update john newpass      Update john's password"
    echo "  $0 list                     Show all users"
    echo "  $0 delete john              Delete user 'john'"
    echo "  $0 summary                  Show environment summary"
    # echo "  $0 interactive              Start interactive menu"
}

# Main case dispatch
case "$1" in
    "add")
        add_user "$2" "$3"
        ;;
    "update")
        update_user "$2" "$3"
        ;;
    "list")
        list_users
        ;;
    "delete")
        delete_user "$2"
        ;;
    "summary")
        show_summary
        ;;
    # "interactive") # Keep only if manageUsers.js handles args differently for interactive mode
    #     log "Starting interactive mode"
    #     node "$MANAGE_USERS_SCRIPT" interactive # Or just node "$MANAGE_USERS_SCRIPT" if it detects no args
    #     ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 