#!/usr/bin/env bash

# User System - Provisional Multiplayer Account Management
# TCS 3.0 compliant with timestamp-based primary keys

# Account types
USER_TYPE_GUEST="guest"           # Session-only, no persistence
USER_TYPE_PROVISIONAL="provisional"  # Persists, time-limited, upgradeable
USER_TYPE_FULL="full"             # Future: full accounts

# Constants
USER_PROVISIONAL_EXPIRY_DAYS=30   # Provisional accounts expire after 30 days
USER_DB_DIR="$GAME_DIR/db/users"

# ============================================================================
# DATABASE PATHS (TCS 3.0 Pattern)
# ============================================================================

# Get user database directory
game_user_get_db_dir() {
    echo "$USER_DB_DIR"
}

# Generate timestamp (primary key)
game_user_generate_timestamp() {
    date +%s
}

# Get user record path
game_user_get_record_path() {
    local timestamp="$1"
    echo "$(game_user_get_db_dir)/${timestamp}.user.toml"
}

# Get session record path
game_user_get_session_path() {
    local timestamp="$1"
    echo "$(game_user_get_db_dir)/${timestamp}.session.toml"
}

# ============================================================================
# USER VALIDATION
# ============================================================================

# Validate username
# Rules: 3-20 chars, alphanumeric + dash/underscore
game_user_validate_name() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Error: Username cannot be empty" >&2
        return 1
    fi

    if [[ ${#name} -lt 3 ]]; then
        echo "Error: Username must be at least 3 characters" >&2
        return 1
    fi

    if [[ ${#name} -gt 20 ]]; then
        echo "Error: Username must be 20 characters or less" >&2
        return 1
    fi

    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Error: Username can only contain letters, numbers, dash, and underscore" >&2
        return 1
    fi

    return 0
}

# Check if username already exists
game_user_exists() {
    local name="$1"

    # Search all user records for matching name
    if [[ ! -d "$(game_user_get_db_dir)" ]]; then
        return 1
    fi

    local user_files=("$(game_user_get_db_dir)"/*.user.toml)
    if [[ ! -f "${user_files[0]}" ]]; then
        return 1
    fi

    for file in "${user_files[@]}"; do
        if [[ -f "$file" ]]; then
            local existing_name=$(grep '^name = ' "$file" | sed 's/name = "\(.*\)"/\1/')
            if [[ "$existing_name" == "$name" ]]; then
                return 0
            fi
        fi
    done

    return 1
}

# ============================================================================
# USER CREATION (PROVISIONAL)
# ============================================================================

# Create provisional user account
# Returns: user_id (timestamp) on success
game_user_create_provisional() {
    local name="$1"
    local org="${2:-$GAME_ACTIVE_ORG}"

    # Validate username
    game_user_validate_name "$name" || return 1

    # Check for collision
    if game_user_exists "$name"; then
        echo "Error: Username '$name' already exists" >&2
        return 1
    fi

    # Generate user ID (timestamp)
    local user_id=$(game_user_generate_timestamp)
    local created=$user_id
    local expires=$((user_id + (USER_PROVISIONAL_EXPIRY_DAYS * 86400)))

    # Create database directory if needed
    mkdir -p "$(game_user_get_db_dir)"

    # Write user record (TOML format)
    local user_file=$(game_user_get_record_path "$user_id")

    cat > "$user_file" <<EOF
# User Record - TCS 3.0 Compliant
# Primary Key: $user_id (Unix timestamp)

[user]
id = "$user_id"
name = "$name"
type = "$USER_TYPE_PROVISIONAL"
created = $created
expires = $expires
status = "active"

[capabilities]
multiplayer = true
save_progress = true
leaderboards = false  # Full account only

[metadata]
org = "$org"
games_played = []
last_login = $created

[stats]
sessions = 0
playtime_seconds = 0
EOF

    echo "$user_id"
}

# ============================================================================
# USER LOADING
# ============================================================================

# Load user by name
# Returns: user_id if found, empty if not
game_user_find_by_name() {
    local name="$1"

    if [[ ! -d "$(game_user_get_db_dir)" ]]; then
        return 1
    fi

    local user_files=("$(game_user_get_db_dir)"/*.user.toml)
    if [[ ! -f "${user_files[0]}" ]]; then
        return 1
    fi

    for file in "${user_files[@]}"; do
        if [[ -f "$file" ]]; then
            local existing_name=$(grep '^name = ' "$file" | sed 's/name = "\(.*\)"/\1/')
            if [[ "$existing_name" == "$name" ]]; then
                # Extract user_id from filename
                local basename=$(basename "$file")
                local user_id="${basename%.user.toml}"
                echo "$user_id"
                return 0
            fi
        fi
    done

    return 1
}

# Load user record
game_user_load() {
    local user_id="$1"
    local user_file=$(game_user_get_record_path "$user_id")

    if [[ ! -f "$user_file" ]]; then
        echo "Error: User not found (ID: $user_id)" >&2
        return 1
    fi

    cat "$user_file"
}

# ============================================================================
# USER LISTING
# ============================================================================

# List all users
game_user_list() {
    echo ""
    text_color "66FFFF"
    echo "📋 User Accounts"
    reset_color
    echo "════════════════════════════════════════════════════════"
    echo ""

    local user_files=("$(game_user_get_db_dir)"/*.user.toml)

    if [[ ! -f "${user_files[0]}" ]]; then
        text_color "666666"
        echo "  No users found"
        reset_color
        echo ""
        return 0
    fi

    for file in "${user_files[@]}"; do
        if [[ -f "$file" ]]; then
            local basename=$(basename "$file")
            local user_id="${basename%.user.toml}"
            local name=$(grep '^name = ' "$file" | sed 's/name = "\(.*\)"/\1/')
            local type=$(grep '^type = ' "$file" | sed 's/type = "\(.*\)"/\1/')
            local created=$(grep '^created = ' "$file" | sed 's/created = //')
            local status=$(grep '^status = ' "$file" | sed 's/status = "\(.*\)"/\1/')

            # Format created date
            local created_date=$(date -r "$created" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$created")

            # Status indicator
            local status_icon="✓"
            local status_color="00AA00"
            if [[ "$status" == "expired" ]]; then
                status_icon="⏰"
                status_color="FFAA00"
            fi

            # Type badge
            text_color "666666"
            printf "  [%-12s] " "$type"
            reset_color

            # Name
            text_color "FFFFFF"
            printf "%-20s" "$name"
            reset_color

            # Status
            text_color "$status_color"
            printf " %s " "$status_icon"
            reset_color

            # ID and date
            text_color "AAAAAA"
            printf "ID: %s  Created: %s" "$user_id" "$created_date"
            reset_color

            echo ""
        fi
    done

    echo ""
}

# ============================================================================
# USER STATUS
# ============================================================================

# Show detailed user status
game_user_show_status() {
    local name="$1"

    if [[ -z "$name" ]]; then
        echo "Error: No username provided" >&2
        return 1
    fi

    local user_id=$(game_user_find_by_name "$name")
    if [[ -z "$user_id" ]]; then
        echo "Error: User '$name' not found" >&2
        return 1
    fi

    local user_file=$(game_user_get_record_path "$user_id")

    echo ""
    text_color "66FFFF"
    echo "👤 User Status: $name"
    reset_color
    echo "════════════════════════════════════════════════════════"
    echo ""

    # Parse user data
    local type=$(grep '^type = ' "$user_file" | sed 's/type = "\(.*\)"/\1/')
    local created=$(grep '^created = ' "$user_file" | sed 's/created = //')
    local expires=$(grep '^expires = ' "$user_file" | sed 's/expires = //')
    local status=$(grep '^status = ' "$user_file" | sed 's/status = "\(.*\)"/\1/')

    local created_date=$(date -r "$created" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$created")
    local expires_date=$(date -r "$expires" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$expires")

    # Calculate days until expiry
    local now=$(date +%s)
    local days_left=$(( (expires - now) / 86400 ))

    text_color "AAAAAA"
    echo "  User ID:       "
    reset_color
    text_color "FFFFFF"
    echo "$user_id"
    reset_color

    text_color "AAAAAA"
    echo "  Account Type:  "
    reset_color
    text_color "FFFFFF"
    echo "$type"
    reset_color

    text_color "AAAAAA"
    echo "  Status:        "
    reset_color
    if [[ "$status" == "active" ]]; then
        text_color "00AA00"
        echo "$status ✓"
    else
        text_color "FFAA00"
        echo "$status"
    fi
    reset_color

    text_color "AAAAAA"
    echo "  Created:       "
    reset_color
    text_color "FFFFFF"
    echo "$created_date"
    reset_color

    if [[ "$type" == "$USER_TYPE_PROVISIONAL" ]]; then
        text_color "AAAAAA"
        echo "  Expires:       "
        reset_color
        if [[ $days_left -lt 7 ]]; then
            text_color "FF0000"
        elif [[ $days_left -lt 14 ]]; then
            text_color "FFAA00"
        else
            text_color "FFFFFF"
        fi
        echo "$expires_date ($days_left days remaining)"
        reset_color
    fi

    echo ""

    # Show capabilities
    text_color "8888FF"
    echo "CAPABILITIES:"
    reset_color
    local multiplayer=$(grep '^multiplayer = ' "$user_file" | sed 's/multiplayer = //')
    local save_progress=$(grep '^save_progress = ' "$user_file" | sed 's/save_progress = //')
    local leaderboards=$(grep '^leaderboards = ' "$user_file" | sed 's/leaderboards = //')

    echo "  Multiplayer:    $multiplayer"
    echo "  Save Progress:  $save_progress"
    echo "  Leaderboards:   $leaderboards"

    echo ""
}

# Export functions
export -f game_user_generate_timestamp game_user_get_record_path game_user_get_session_path
export -f game_user_validate_name game_user_exists
export -f game_user_create_provisional game_user_find_by_name game_user_load
export -f game_user_list game_user_show_status
