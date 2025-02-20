#!/bin/bash

# Get the directory containing this script
SCRIPT_DIR=$(dirname $(readlink -f ${0}))

# Ensure we're in the right directory context
cd $SCRIPT_DIR

# Set PJA_USERS_CSV if not already set
export PJA_USERS_CSV=${PJA_USERS_CSV:-"$SCRIPT_DIR/users.csv"}

# Log with timestamps and prefixes
log() {
    echo "[$(date '+%H:%M:%S')] [USERS] $1"
}

error() {
    echo "[$(date '+%H:%M:%S')] [USERS ERROR] $1" >&2
}

# Function to show summary
show_summary() {
    log "Environment Summary:"
    log "PJA_USERS_CSV = $PJA_USERS_CSV"
    log "Current users in file:"
    list_users
}

# Function to add a user
add_user() {
    if [ -z "$1" ] || [ -z "$2" ]; then
        error "Usage: $0 add <username> <password>"
        exit 1
    fi
    
    local username="$1"
    local password="$2"
    
    log "Adding user: $username"
    node -e "
        const { addUser } = require('./server/utils/manageUsers');
        addUser('$username', '$password').then(() => process.exit(0));
    "
}

# Function to list users
list_users() {
    log "Listing users"
    node -e "
        const { listUsers } = require('./server/utils/manageUsers');
        listUsers();
    "
}

# Function to delete a user
delete_user() {
    if [ -z "$1" ]; then
        error "Usage: $0 delete <username>"
        exit 1
    fi
    
    local username="$1"
    log "Deleting user: $username"
    node -e "
        const { deleteUser } = require('./server/utils/manageUsers');
        deleteUser('$username').then(() => process.exit(0));
    "
}

# Function to show help
show_help() {
    echo "Usage: $0 <command> [args]"
    echo
    echo "Commands:"
    echo "  add <username> <password>  Add a new user"
    echo "  list                       List all users"
    echo "  delete <username>          Delete a user"
    echo "  interactive               Start interactive mode"
    echo "  summary                   Show environment summary"
    echo "  help                      Show this help"
    echo
    echo "Environment:"
    echo "  PJA_USERS_CSV            Path to users file (default: ./users.csv)"
    echo
    echo "Examples:"
    echo "  $0 add john secret123     Add user 'john' with password 'secret123'"
    echo "  $0 list                   Show all users"
    echo "  $0 delete john            Delete user 'john'"
    echo "  $0 summary                Show environment summary"
    echo "  $0 interactive            Start interactive menu"
}

# Main case dispatch
case "$1" in
    "add")
        add_user "$2" "$3"
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
    "interactive")
        log "Starting interactive mode"
        node server/utils/manageUsers.js
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 