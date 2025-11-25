#!/usr/bin/env bash
# tkm_remote.sh - Remote authorized_keys management
#
# Manage SSH authorized_keys on remote servers.
# Parse, list, add, and remove keys safely.
#
# Flags:
#   -f, --force    Skip confirmation prompts
#   -n, --dry-run  Show what would happen without making changes

# =============================================================================
# GLOBALS FOR FLAGS
# =============================================================================

TKM_FORCE=false
TKM_DRY_RUN=false

# Parse flags from args, return remaining args
_tkm_parse_flags() {
    TKM_FORCE=false
    TKM_DRY_RUN=false

    local args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f|--force)   TKM_FORCE=true ;;
            -n|--dry-run) TKM_DRY_RUN=true ;;
            *)            args+=("$1") ;;
        esac
        shift
    done
    echo "${args[@]}"
}

# Confirmation prompt (respects --force)
_tkm_confirm() {
    local msg="${1:-Confirm?}"

    [[ "$TKM_FORCE" == true ]] && return 0

    read -p "$msg [y/N] " -n 1 -r
    echo ""
    [[ $REPLY =~ ^[Yy]$ ]]
}

# =============================================================================
# FETCH / LIST REMOTE KEYS
# =============================================================================

# Fetch authorized_keys from remote host
# Usage: tkm_remote_fetch <env> [user]
tkm_remote_fetch() {
    local env="$1"
    local remote_user="${2:-root}"

    [[ -z "$env" ]] && { echo "Usage: tkm remote fetch <env> [user]"; return 1; }

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    local auth_user=$(_tkm_get_auth_user "$env")
    local remote_home
    if [[ "$remote_user" == "root" ]]; then
        remote_home="/root"
    else
        remote_home="/home/$remote_user"
    fi

    ssh "$auth_user@$host" "cat $remote_home/.ssh/authorized_keys 2>/dev/null"
}

# List remote keys in parsed format
# Usage: tkm_remote_list <env> [user]
tkm_remote_list() {
    local env="$1"
    local remote_user="${2:-root}"

    [[ -z "$env" ]] && { echo "Usage: tkm remote list <env> [user]"; return 1; }

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    echo "Authorized keys for $remote_user@$host"
    echo "======================================="
    echo ""

    local keys
    keys=$(tkm_remote_fetch "$env" "$remote_user") || { echo "Failed to fetch keys"; return 1; }

    if [[ -z "$keys" ]]; then
        echo "(no keys)"
        return 0
    fi

    local idx=0
    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue

        ((idx++))
        local parsed
        parsed=$(_tkm_parse_key_line "$line")

        local type key_short comment fp
        type=$(echo "$parsed" | cut -d'|' -f1)
        key_short=$(echo "$parsed" | cut -d'|' -f2)
        comment=$(echo "$parsed" | cut -d'|' -f3)
        fp=$(echo "$parsed" | cut -d'|' -f4)

        printf "[%d] %s\n" "$idx" "$comment"
        printf "    Type: %s  Fingerprint: %s\n" "$type" "$fp"
        echo ""
    done <<< "$keys"

    echo "Total: $idx key(s)"
}

# Show remote keys with full details (for auditing)
tkm_remote_audit() {
    local env="$1"
    local remote_user="${2:-root}"

    [[ -z "$env" ]] && { echo "Usage: tkm remote audit <env> [user]"; return 1; }

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    echo "Audit: $remote_user@$host authorized_keys"
    echo "=========================================="
    echo ""

    local keys
    keys=$(tkm_remote_fetch "$env" "$remote_user") || { echo "Failed to fetch keys"; return 1; }

    if [[ -z "$keys" ]]; then
        echo "(no keys)"
        return 0
    fi

    # Compare with local known keys
    local keys_dir=$(tkm_keys_dir)
    local local_fps=()

    # Collect local fingerprints
    if [[ -d "$keys_dir" ]]; then
        for pub in "$keys_dir"/*.pub; do
            [[ -f "$pub" ]] || continue
            local lfp=$(ssh-keygen -l -f "$pub" 2>/dev/null | awk '{print $2}')
            local_fps+=("$lfp")
        done
    fi

    local idx=0
    local known=0
    local unknown=0

    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue

        ((idx++))
        local parsed
        parsed=$(_tkm_parse_key_line "$line")

        local type key_short comment fp
        type=$(echo "$parsed" | cut -d'|' -f1)
        key_short=$(echo "$parsed" | cut -d'|' -f2)
        comment=$(echo "$parsed" | cut -d'|' -f3)
        fp=$(echo "$parsed" | cut -d'|' -f4)

        # Check if known locally
        local status="UNKNOWN"
        for lfp in "${local_fps[@]}"; do
            if [[ "$fp" == "$lfp" ]]; then
                status="KNOWN"
                ((known++))
                break
            fi
        done
        [[ "$status" == "UNKNOWN" ]] && ((unknown++))

        printf "[%d] %-8s %s\n" "$idx" "[$status]" "$comment"
        printf "    Type: %-10s Fingerprint: %s\n" "$type" "$fp"
        echo ""
    done <<< "$keys"

    echo "Summary: $idx total, $known known, $unknown unknown"
}

# =============================================================================
# ADD KEY
# =============================================================================

# Add a key to remote authorized_keys
# Usage: tkm_remote_add <env> <user> <keyfile|fingerprint>
tkm_remote_add() {
    local env="$1"
    local remote_user="$2"
    local key_source="$3"

    if [[ -z "$env" || -z "$remote_user" || -z "$key_source" ]]; then
        echo "Usage: tkm remote add <env> <user> <keyfile>"
        echo "       tkm remote add <env> <user> <local-keyname>"
        return 1
    fi

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    local auth_user=$(_tkm_get_auth_user "$env")
    local remote_home
    if [[ "$remote_user" == "root" ]]; then
        remote_home="/root"
    else
        remote_home="/home/$remote_user"
    fi

    # Resolve key source
    local pubkey_content
    local keys_dir=$(tkm_keys_dir)

    if [[ -f "$key_source" ]]; then
        # Direct file path
        pubkey_content=$(cat "$key_source")
    elif [[ -f "${key_source}.pub" ]]; then
        # Key file without .pub extension
        pubkey_content=$(cat "${key_source}.pub")
    elif [[ -f "$keys_dir/${key_source}.pub" ]]; then
        # Local tkm key name
        pubkey_content=$(cat "$keys_dir/${key_source}.pub")
    elif [[ -f "$keys_dir/$key_source" ]]; then
        # Local tkm key name (already has .pub)
        pubkey_content=$(cat "$keys_dir/$key_source")
    else
        echo "Key not found: $key_source"
        echo "Tried: $key_source, ${key_source}.pub, $keys_dir/${key_source}.pub"
        return 1
    fi

    # Validate it looks like a public key
    if ! echo "$pubkey_content" | grep -qE '^(ssh-|ecdsa-)'; then
        echo "Invalid public key format"
        return 1
    fi

    # Get fingerprint for duplicate check
    local new_fp
    new_fp=$(echo "$pubkey_content" | ssh-keygen -l -f - 2>/dev/null | awk '{print $2}')

    echo "Adding key to $remote_user@$host"
    echo "  Fingerprint: $new_fp"

    # Check for duplicate
    local existing
    existing=$(tkm_remote_fetch "$env" "$remote_user" 2>/dev/null)

    if [[ -n "$existing" ]]; then
        while IFS= read -r line; do
            [[ -z "$line" || "$line" =~ ^# ]] && continue
            local existing_fp
            existing_fp=$(echo "$line" | ssh-keygen -l -f - 2>/dev/null | awk '{print $2}')
            if [[ "$new_fp" == "$existing_fp" ]]; then
                echo "  [!] Key already exists on remote"
                return 0
            fi
        done <<< "$existing"
    fi

    # Add the key
    if echo "$pubkey_content" | ssh "$auth_user@$host" \
        "mkdir -p $remote_home/.ssh && chmod 700 $remote_home/.ssh && cat >> $remote_home/.ssh/authorized_keys && chmod 600 $remote_home/.ssh/authorized_keys" 2>/dev/null; then

        # Fix ownership if not root
        if [[ "$remote_user" != "root" ]]; then
            ssh "$auth_user@$host" "chown -R $remote_user:$remote_user $remote_home/.ssh" 2>/dev/null
        fi

        echo "  [OK] Key added"
        return 0
    else
        echo "  [FAIL] Could not add key"
        return 1
    fi
}

# =============================================================================
# REMOVE KEY
# =============================================================================

# Remove a key from remote authorized_keys by index, fingerprint, or comment pattern
# Usage: tkm_remote_rm [-f] [-n] <env> <user> <index|fingerprint|pattern>
tkm_remote_rm() {
    local args
    read -ra args <<< "$(_tkm_parse_flags "$@")"
    set -- "${args[@]}"

    local env="$1"
    local remote_user="$2"
    local selector="$3"

    if [[ -z "$env" || -z "$remote_user" || -z "$selector" ]]; then
        echo "Usage: tkm remote rm [-f] [-n] <env> <user> <index|fingerprint|pattern>"
        echo ""
        echo "Flags:"
        echo "  -f, --force    Skip confirmation"
        echo "  -n, --dry-run  Show what would be removed"
        echo ""
        echo "Examples:"
        echo "  tkm remote rm dev root 3              # Remove key #3"
        echo "  tkm remote rm dev root SHA256:abc...  # Remove by fingerprint"
        echo "  tkm remote rm dev root tkm_dev_root   # Remove by comment pattern"
        echo "  tkm remote rm -f dev root 3           # Force remove without confirm"
        return 1
    fi

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    local auth_user=$(_tkm_get_auth_user "$env")
    local remote_home
    if [[ "$remote_user" == "root" ]]; then
        remote_home="/root"
    else
        remote_home="/home/$remote_user"
    fi

    # Fetch current keys
    local keys
    keys=$(tkm_remote_fetch "$env" "$remote_user") || { echo "Failed to fetch keys"; return 1; }

    if [[ -z "$keys" ]]; then
        echo "No keys to remove"
        return 0
    fi

    # Find key to remove
    local target_line=""
    local target_fp=""
    local target_comment=""
    local idx=0

    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        ((idx++))

        local parsed
        parsed=$(_tkm_parse_key_line "$line")
        local fp=$(echo "$parsed" | cut -d'|' -f4)
        local comment=$(echo "$parsed" | cut -d'|' -f3)

        # Match by index
        if [[ "$selector" =~ ^[0-9]+$ && "$idx" -eq "$selector" ]]; then
            target_line="$line"
            target_fp="$fp"
            target_comment="$comment"
            break
        fi

        # Match by fingerprint (partial OK)
        if [[ "$fp" == *"$selector"* ]]; then
            target_line="$line"
            target_fp="$fp"
            target_comment="$comment"
            break
        fi

        # Match by comment pattern
        if [[ "$comment" == *"$selector"* ]]; then
            target_line="$line"
            target_fp="$fp"
            target_comment="$comment"
            break
        fi
    done <<< "$keys"

    if [[ -z "$target_line" ]]; then
        echo "No key matching: $selector"
        return 1
    fi

    echo "Removing key from $remote_user@$host"
    echo "  Comment: $target_comment"
    echo "  Fingerprint: $target_fp"
    echo ""

    if [[ "$TKM_DRY_RUN" == true ]]; then
        echo "[dry-run] Would remove this key"
        return 0
    fi

    if ! _tkm_confirm "Confirm removal?"; then
        echo "Cancelled"
        return 0
    fi

    # Build new authorized_keys without the target
    local new_keys=""
    while IFS= read -r line; do
        if [[ "$line" != "$target_line" ]]; then
            new_keys+="$line"$'\n'
        fi
    done <<< "$keys"

    # Write back
    if echo "$new_keys" | ssh "$auth_user@$host" \
        "cat > $remote_home/.ssh/authorized_keys && chmod 600 $remote_home/.ssh/authorized_keys" 2>/dev/null; then
        echo "  [OK] Key removed"
        return 0
    else
        echo "  [FAIL] Could not update authorized_keys"
        return 1
    fi
}

# =============================================================================
# SYNC / CLEAN
# =============================================================================

# Remove all keys matching a pattern (e.g., old tkm keys)
# Usage: tkm_remote_clean [-f] [-n] <env> <user> <pattern>
tkm_remote_clean() {
    local args
    read -ra args <<< "$(_tkm_parse_flags "$@")"
    set -- "${args[@]}"

    local env="$1"
    local remote_user="$2"
    local pattern="$3"

    if [[ -z "$env" || -z "$remote_user" || -z "$pattern" ]]; then
        echo "Usage: tkm remote clean [-f] [-n] <env> <user> <pattern>"
        echo ""
        echo "Flags:"
        echo "  -f, --force    Skip confirmation"
        echo "  -n, --dry-run  Show what would be removed"
        echo ""
        echo "Removes ALL keys matching the comment pattern."
        echo "Example: tkm remote clean dev root 'tkm_*'"
        return 1
    fi

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    local auth_user=$(_tkm_get_auth_user "$env")
    local remote_home
    if [[ "$remote_user" == "root" ]]; then
        remote_home="/root"
    else
        remote_home="/home/$remote_user"
    fi

    # Fetch current keys
    local keys
    keys=$(tkm_remote_fetch "$env" "$remote_user") || { echo "Failed to fetch keys"; return 1; }

    # Find matching keys
    local matches=()
    local keep_keys=""

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        # Keep comments
        if [[ "$line" =~ ^# ]]; then
            keep_keys+="$line"$'\n'
            continue
        fi

        local parsed
        parsed=$(_tkm_parse_key_line "$line")
        local comment=$(echo "$parsed" | cut -d'|' -f3)
        local fp=$(echo "$parsed" | cut -d'|' -f4)

        # shellcheck disable=SC2053
        if [[ "$comment" == $pattern ]]; then
            matches+=("$comment ($fp)")
        else
            keep_keys+="$line"$'\n'
        fi
    done <<< "$keys"

    if [[ ${#matches[@]} -eq 0 ]]; then
        echo "No keys matching pattern: $pattern"
        return 0
    fi

    echo "Keys to remove from $remote_user@$host:"
    for m in "${matches[@]}"; do
        echo "  - $m"
    done
    echo ""

    if [[ "$TKM_DRY_RUN" == true ]]; then
        echo "[dry-run] Would remove ${#matches[@]} key(s)"
        return 0
    fi

    if ! _tkm_confirm "Remove ${#matches[@]} key(s)?"; then
        echo "Cancelled"
        return 0
    fi

    # Write back
    if echo "$keep_keys" | ssh "$auth_user@$host" \
        "cat > $remote_home/.ssh/authorized_keys && chmod 600 $remote_home/.ssh/authorized_keys" 2>/dev/null; then
        echo "[OK] Removed ${#matches[@]} key(s)"
        return 0
    else
        echo "[FAIL] Could not update authorized_keys"
        return 1
    fi
}

# =============================================================================
# DIFF
# =============================================================================

# Show difference between local expected keys and remote authorized_keys
# Usage: tkm_remote_diff <env> [user]
tkm_remote_diff() {
    local env="$1"
    local remote_user="${2:-root}"

    [[ -z "$env" ]] && { echo "Usage: tkm remote diff <env> [user]"; return 1; }

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    local keys_dir=$(tkm_keys_dir)
    [[ ! -d "$keys_dir" ]] && { echo "No local keys directory"; return 1; }

    echo "Diff: $remote_user@$host"
    echo "======================"
    echo ""

    # Fetch remote keys and build fingerprint set
    local remote_keys
    remote_keys=$(tkm_remote_fetch "$env" "$remote_user" 2>/dev/null) || { echo "Failed to fetch remote keys"; return 1; }

    declare -A remote_fps
    declare -A remote_comments

    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        local parsed=$(_tkm_parse_key_line "$line")
        local fp=$(echo "$parsed" | cut -d'|' -f4)
        local comment=$(echo "$parsed" | cut -d'|' -f3)
        [[ "$fp" != "(invalid)" ]] && remote_fps["$fp"]=1
        remote_comments["$fp"]="$comment"
    done <<< "$remote_keys"

    # Find expected local keys for this env/user
    local expected_keys=()
    local app_user=$(tkm_app_user "$env")

    if [[ "$remote_user" == "root" ]]; then
        expected_keys+=("${env}_root")
    elif [[ "$remote_user" == "$app_user" ]]; then
        expected_keys+=("${env}_${app_user}")
    fi

    # Also check any key that matches the user pattern
    for pub in "$keys_dir"/*.pub; do
        [[ -f "$pub" ]] || continue
        local keyname=$(basename "$pub" .pub)
        # Skip revoked
        [[ "$keyname" == *.revoked.* ]] && continue
        # Match env_user pattern
        if [[ "$keyname" == "${env}_${remote_user}" ]]; then
            [[ ! " ${expected_keys[*]} " =~ " $keyname " ]] && expected_keys+=("$keyname")
        fi
    done

    # Build local fingerprint set
    declare -A local_fps
    declare -A local_names

    for keyname in "${expected_keys[@]}"; do
        local pub="$keys_dir/${keyname}.pub"
        [[ -f "$pub" ]] || continue
        local fp=$(ssh-keygen -l -f "$pub" 2>/dev/null | awk '{print $2}')
        [[ -n "$fp" ]] && local_fps["$fp"]="$keyname"
        local_names["$keyname"]="$fp"
    done

    # Calculate diff
    local to_add=()
    local to_remove=()
    local present=()

    # Keys to add (in local but not remote)
    for fp in "${!local_fps[@]}"; do
        if [[ -z "${remote_fps[$fp]:-}" ]]; then
            to_add+=("${local_fps[$fp]} ($fp)")
        else
            present+=("${local_fps[$fp]} ($fp)")
        fi
    done

    # Keys to remove (in remote but not local, only tkm_ keys)
    for fp in "${!remote_fps[@]}"; do
        if [[ -z "${local_fps[$fp]:-}" ]]; then
            local comment="${remote_comments[$fp]}"
            # Only flag tkm-managed keys for removal
            if [[ "$comment" == tkm_* ]]; then
                to_remove+=("$comment ($fp)")
            fi
        fi
    done

    # Output
    if [[ ${#present[@]} -gt 0 ]]; then
        echo "Present (OK):"
        for k in "${present[@]}"; do
            echo "  = $k"
        done
        echo ""
    fi

    if [[ ${#to_add[@]} -gt 0 ]]; then
        echo "Missing (to add):"
        for k in "${to_add[@]}"; do
            echo "  + $k"
        done
        echo ""
    fi

    if [[ ${#to_remove[@]} -gt 0 ]]; then
        echo "Extra tkm keys (to remove):"
        for k in "${to_remove[@]}"; do
            echo "  - $k"
        done
        echo ""
    fi

    if [[ ${#to_add[@]} -eq 0 && ${#to_remove[@]} -eq 0 ]]; then
        echo "In sync!"
    else
        echo "Run 'tkm remote sync $env $remote_user' to apply changes"
    fi

    # Return status: 0 if in sync, 1 if changes needed
    [[ ${#to_add[@]} -eq 0 && ${#to_remove[@]} -eq 0 ]]
}

# =============================================================================
# SYNC
# =============================================================================

# Sync remote authorized_keys to match local expected keys
# Usage: tkm_remote_sync [-f] [-n] <env> [user]
tkm_remote_sync() {
    local args
    read -ra args <<< "$(_tkm_parse_flags "$@")"
    set -- "${args[@]}"

    local env="$1"
    local remote_user="${2:-root}"

    if [[ -z "$env" ]]; then
        echo "Usage: tkm remote sync [-f] [-n] <env> [user]"
        echo ""
        echo "Flags:"
        echo "  -f, --force    Skip confirmation"
        echo "  -n, --dry-run  Show what would change"
        echo ""
        echo "Adds missing local keys and removes stale tkm_* keys from remote."
        return 1
    fi

    local host=$(_tkm_get_host "$env")
    [[ -z "$host" ]] && { echo "No host for $env"; return 1; }

    local auth_user=$(_tkm_get_auth_user "$env")
    local keys_dir=$(tkm_keys_dir)
    [[ ! -d "$keys_dir" ]] && { echo "No local keys directory"; return 1; }

    local remote_home
    if [[ "$remote_user" == "root" ]]; then
        remote_home="/root"
    else
        remote_home="/home/$remote_user"
    fi

    echo "Sync: $remote_user@$host"
    echo "====================="
    echo ""

    # Fetch remote keys
    local remote_keys
    remote_keys=$(tkm_remote_fetch "$env" "$remote_user" 2>/dev/null) || { echo "Failed to fetch remote keys"; return 1; }

    declare -A remote_fps
    declare -A remote_lines

    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^# ]] && continue
        local parsed=$(_tkm_parse_key_line "$line")
        local fp=$(echo "$parsed" | cut -d'|' -f4)
        local comment=$(echo "$parsed" | cut -d'|' -f3)
        [[ "$fp" != "(invalid)" ]] && remote_fps["$fp"]="$comment"
        remote_lines["$fp"]="$line"
    done <<< "$remote_keys"

    # Find expected local keys
    local app_user=$(tkm_app_user "$env")
    local expected_key=""

    if [[ "$remote_user" == "root" ]]; then
        expected_key="${env}_root"
    elif [[ "$remote_user" == "$app_user" ]]; then
        expected_key="${env}_${app_user}"
    else
        expected_key="${env}_${remote_user}"
    fi

    # Get local key fingerprint
    local local_pub="$keys_dir/${expected_key}.pub"
    local local_fp=""
    local local_content=""

    if [[ -f "$local_pub" ]]; then
        local_fp=$(ssh-keygen -l -f "$local_pub" 2>/dev/null | awk '{print $2}')
        local_content=$(cat "$local_pub")
    fi

    # Calculate changes
    local to_add=""
    local to_remove=()

    # Check if local key needs to be added
    if [[ -n "$local_fp" && -z "${remote_fps[$local_fp]:-}" ]]; then
        to_add="$expected_key"
        echo "Add: $expected_key"
        echo "     $local_fp"
    elif [[ -n "$local_fp" ]]; then
        echo "OK:  $expected_key"
        echo "     $local_fp"
    else
        echo "Skip: No local key $expected_key"
    fi
    echo ""

    # Find tkm keys to remove (not matching current local key)
    for fp in "${!remote_fps[@]}"; do
        local comment="${remote_fps[$fp]}"
        # Only remove tkm-managed keys that don't match our current key
        if [[ "$comment" == tkm_* && "$fp" != "$local_fp" ]]; then
            to_remove+=("$fp")
            echo "Remove: $comment"
            echo "        $fp"
        fi
    done

    if [[ ${#to_remove[@]} -gt 0 ]]; then
        echo ""
    fi

    # Check if any changes needed
    if [[ -z "$to_add" && ${#to_remove[@]} -eq 0 ]]; then
        echo "Already in sync!"
        return 0
    fi

    echo "---"
    local change_count=0
    [[ -n "$to_add" ]] && ((change_count++))
    ((change_count += ${#to_remove[@]}))
    echo "Changes: $change_count"
    echo ""

    if [[ "$TKM_DRY_RUN" == true ]]; then
        echo "[dry-run] No changes made"
        return 0
    fi

    if ! _tkm_confirm "Apply changes?"; then
        echo "Cancelled"
        return 0
    fi

    # Build new authorized_keys
    local new_keys=""

    # Keep non-tkm keys and tkm keys that match current
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue

        # Keep comments
        if [[ "$line" =~ ^# ]]; then
            new_keys+="$line"$'\n'
            continue
        fi

        local parsed=$(_tkm_parse_key_line "$line")
        local fp=$(echo "$parsed" | cut -d'|' -f4)
        local comment=$(echo "$parsed" | cut -d'|' -f3)

        # Keep if: not tkm key, or matches current local key
        if [[ "$comment" != tkm_* ]] || [[ "$fp" == "$local_fp" ]]; then
            new_keys+="$line"$'\n'
        fi
    done <<< "$remote_keys"

    # Add local key if needed
    if [[ -n "$to_add" && -n "$local_content" ]]; then
        new_keys+="$local_content"$'\n'
    fi

    # Write to remote
    if echo "$new_keys" | ssh "$auth_user@$host" \
        "mkdir -p $remote_home/.ssh && chmod 700 $remote_home/.ssh && cat > $remote_home/.ssh/authorized_keys && chmod 600 $remote_home/.ssh/authorized_keys" 2>/dev/null; then

        # Fix ownership if not root
        if [[ "$remote_user" != "root" ]]; then
            ssh "$auth_user@$host" "chown -R $remote_user:$remote_user $remote_home/.ssh" 2>/dev/null
        fi

        echo "[OK] Sync complete"
        return 0
    else
        echo "[FAIL] Could not update authorized_keys"
        return 1
    fi
}

# =============================================================================
# HELPERS
# =============================================================================

# Parse a single authorized_keys line
# Returns: type|key_short|comment|fingerprint
_tkm_parse_key_line() {
    local line="$1"

    # Handle options prefix (from=, command=, etc.)
    local key_part="$line"
    if [[ "$line" =~ ^[a-z]+=.* && ! "$line" =~ ^(ssh-|ecdsa-) ]]; then
        # Has options - extract key part
        key_part=$(echo "$line" | grep -oE '(ssh-|ecdsa-)[^ ]+[[:space:]]+[^ ]+([[:space:]]+.*)?$')
    fi

    # Parse: type base64 comment
    local type key comment
    type=$(echo "$key_part" | awk '{print $1}')
    key=$(echo "$key_part" | awk '{print $2}')
    comment=$(echo "$key_part" | awk '{$1=$2=""; print}' | sed 's/^[[:space:]]*//')

    [[ -z "$comment" ]] && comment="(no comment)"

    # Get fingerprint
    local fp
    fp=$(echo "$line" | ssh-keygen -l -f - 2>/dev/null | awk '{print $2}')
    [[ -z "$fp" ]] && fp="(invalid)"

    # Short key (first 20 chars)
    local key_short="${key:0:20}..."

    echo "${type}|${key_short}|${comment}|${fp}"
}

# =============================================================================
# MAIN DISPATCH
# =============================================================================

tkm_remote() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    case "$cmd" in
        fetch|get)   tkm_remote_fetch "$@" ;;
        list|ls)     tkm_remote_list "$@" ;;
        audit)       tkm_remote_audit "$@" ;;
        add)         tkm_remote_add "$@" ;;
        rm|remove)   tkm_remote_rm "$@" ;;
        clean)       tkm_remote_clean "$@" ;;
        diff)        tkm_remote_diff "$@" ;;
        sync)        tkm_remote_sync "$@" ;;
        help|--help|-h|"")
            cat << 'EOF'
tkm remote - Manage remote authorized_keys

COMMANDS
    fetch <env> [user]              Fetch raw authorized_keys content
    list <env> [user]               List keys with fingerprints
    audit <env> [user]              Audit keys (show known/unknown)
    add <env> <user> <keyfile>      Add a key (checks duplicates)
    rm <env> <user> <selector>      Remove key by index/fingerprint/pattern
    clean <env> <user> <pattern>    Remove all keys matching pattern
    diff <env> [user]               Compare local vs remote keys
    sync <env> [user]               Sync remote to match local keys

FLAGS (for rm, clean, sync)
    -f, --force                     Skip confirmation prompts
    -n, --dry-run                   Show what would happen

EXAMPLES
    tkm remote list dev root        # List root's keys on dev
    tkm remote audit prod root      # Audit prod keys vs local
    tkm remote diff dev root        # Show what's different
    tkm remote sync dev root        # Make remote match local
    tkm remote sync -n dev root     # Dry-run sync
    tkm remote add dev root dev_root.pub
    tkm remote rm dev root 3        # Remove key #3
    tkm remote rm -f dev root 3     # Force remove (no confirm)
    tkm remote clean dev root 'tkm_*'
EOF
            ;;
        *)
            echo "Unknown remote command: $cmd"
            echo "Try: tkm remote help"
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tkm_remote tkm_remote_fetch tkm_remote_list tkm_remote_audit
export -f tkm_remote_add tkm_remote_rm tkm_remote_clean
export -f tkm_remote_diff tkm_remote_sync
export -f _tkm_parse_key_line _tkm_parse_flags _tkm_confirm
export TKM_FORCE TKM_DRY_RUN
