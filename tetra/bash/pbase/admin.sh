#!/usr/bin/env bash

# admin.sh - pdata administration functions
# User, file, capability, and audit management

admin_user_add() {
    local username="$1"
    local password="$2"
    local role="${3:-user}"

    if [ -z "$username" ] || [ -z "$password" ]; then
        echo "Usage: admin user add <username> <password> [role]"
        return 1
    fi

    cd "$PDATA_SRC" || return 1
    node --input-type=module <<EOF
import { addUser } from './manageUsers.js';
await addUser('$username', '$password', '$role');
EOF
}

admin_user_list() {
    cd "$PDATA_SRC" || return 1
    node --input-type=module <<EOF
import { listUsers } from './manageUsers.js';
listUsers();
EOF
}

admin_user_delete() {
    local username="$1"

    if [ -z "$username" ]; then
        echo "Usage: admin user delete <username>"
        return 1
    fi

    cd "$PDATA_SRC" || return 1
    node --input-type=module <<EOF
import { deleteUser } from './manageUsers.js';
await deleteUser('$username');
EOF
}

admin_file_list() {
    local path="${1:-.}"

    if [ -z "$PD_DIR" ]; then
        echo "ERROR: PD_DIR not set" >&2
        return 1
    fi

    echo "Files in $PD_DIR/$path:"
    ls -lah "$PD_DIR/$path" 2>/dev/null || echo "Path not found"
}

admin_file_tree() {
    local path="${1:-.}"

    if [ -z "$PD_DIR" ]; then
        echo "ERROR: PD_DIR not set" >&2
        return 1
    fi

    tree -L 3 "$PD_DIR/$path" 2>/dev/null || ls -R "$PD_DIR/$path"
}

admin_capability_list() {
    if [ -z "$PD_DIR" ]; then
        echo "ERROR: PD_DIR not set" >&2
        return 1
    fi

    local roles_file="$PD_DIR/roles.csv"

    if [ -f "$roles_file" ]; then
        echo "=== Capabilities by Role ==="
        column -t -s',' "$roles_file"
    else
        echo "No roles file found at $roles_file"
    fi
}

admin_audit_tail() {
    local lines="${1:-20}"

    if [ -z "$PD_DIR" ]; then
        echo "ERROR: PD_DIR not set" >&2
        return 1
    fi

    local audit_log="$PD_DIR/audit.log"

    if [ -f "$audit_log" ]; then
        tail -n "$lines" "$audit_log"
    else
        echo "No audit log found at $audit_log"
    fi
}

admin_audit_watch() {
    if [ -z "$PD_DIR" ]; then
        echo "ERROR: PD_DIR not set" >&2
        return 1
    fi

    local audit_log="$PD_DIR/audit.log"

    if [ -f "$audit_log" ]; then
        tail -f "$audit_log"
    else
        echo "No audit log found at $audit_log"
    fi
}

admin_status() {
    echo "=== PData Status ==="
    echo ""
    echo "Data Directory: $PD_DIR"
    echo "Source:         $PDATA_SRC"
    echo ""

    if [ -d "$PD_DIR" ]; then
        echo "Users:  $(wc -l < "$PD_DIR/users.csv" 2>/dev/null || echo 0)"
        echo "Roles:  $(wc -l < "$PD_DIR/roles.csv" 2>/dev/null || echo 0)"
        echo "Size:   $(du -sh "$PD_DIR" 2>/dev/null | cut -f1)"
    else
        echo "Data directory not initialized"
    fi
}

# Main dispatcher
admin() {
    case "$1" in
        user)
            shift
            case "$1" in
                add) shift; admin_user_add "$@" ;;
                list) admin_user_list ;;
                delete) shift; admin_user_delete "$@" ;;
                *) echo "Usage: admin user {add|list|delete}" ;;
            esac
            ;;
        file)
            shift
            case "$1" in
                list) shift; admin_file_list "$@" ;;
                tree) shift; admin_file_tree "$@" ;;
                *) echo "Usage: admin file {list|tree} [path]" ;;
            esac
            ;;
        capability)
            shift
            case "$1" in
                list) admin_capability_list ;;
                *) echo "Usage: admin capability {list}" ;;
            esac
            ;;
        audit)
            shift
            case "$1" in
                tail) shift; admin_audit_tail "$@" ;;
                watch) admin_audit_watch ;;
                *) echo "Usage: admin audit {tail|watch}" ;;
            esac
            ;;
        status)
            admin_status
            ;;
        *)
            cat <<EOF
Usage: admin <command>

Commands:
  user add <username> <password> [role]    Add user
  user list                                 List users
  user delete <username>                    Delete user

  file list [path]                          List files
  file tree [path]                          Show file tree

  capability list                           List role capabilities

  audit tail [lines]                        Show recent audit log
  audit watch                               Watch audit log (live)

  status                                    Show pdata status
EOF
            ;;
    esac
}
