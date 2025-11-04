#!/usr/bin/env bash
# TAS Alias System
# Maps short aliases to full action names

# Alias registry file
ALIAS_REGISTRY="${TETRA_DIR}/actions.aliases"

# Default aliases (built-in)
declare -gA DEFAULT_ALIASES=(
    [q]="query"
    [s]="send"
    [ls]="list"
    [rm]="delete"
    [cp]="copy"
    [mv]="move"
    [cat]="read"
    [grep]="search"
    [find]="locate"
    [deploy]="d"
    [restart]="r"
    [monitor]="m"
    [validate]="v"
    [test]="t"
    [build]="b"
)

# User aliases (loaded from file)
declare -gA USER_ALIASES=()

# Initialize alias system
# Usage: alias_init
alias_init() {
    # Load user aliases if file exists
    if [[ -f "$ALIAS_REGISTRY" ]]; then
        alias_load
    else
        alias_create_default_config
    fi
}

# Create default alias configuration file
alias_create_default_config() {
    mkdir -p "$(dirname "$ALIAS_REGISTRY")"

    cat > "$ALIAS_REGISTRY" <<'EOF'
# Tetra Action Aliases
# Format: alias=action
# One per line, no spaces around =

# Common shortcuts
q=query
s=send
ls=list
rm=delete
cp=copy
mv=move

# Additional shortcuts
cat=read
grep=search
find=locate

# Module-specific (uncomment to enable)
# d=deploy
# r=restart
# m=monitor
# v=validate
# t=test
# b=build

# Custom aliases (add your own below)
# myalias=myaction
EOF

    echo "Created default alias configuration: $ALIAS_REGISTRY" >&2
}

# Load user aliases from file
# Usage: alias_load
alias_load() {
    if [[ ! -f "$ALIAS_REGISTRY" ]]; then
        return 0
    fi

    # Clear existing user aliases
    USER_ALIASES=()

    # Read file line by line
    while IFS='=' read -r alias_name action_name; do
        # Skip empty lines and comments
        [[ -z "$alias_name" || "$alias_name" == \#* ]] && continue

        # Trim whitespace
        alias_name=$(echo "$alias_name" | xargs)
        action_name=$(echo "$action_name" | xargs)

        # Store alias
        USER_ALIASES["$alias_name"]="$action_name"
    done < "$ALIAS_REGISTRY"
}

# Resolve alias to full action name
# Usage: alias_resolve alias_or_action
# Returns: Full action name
alias_resolve() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "$input"
        return 0
    fi

    # Check user aliases first
    if [[ -n "${USER_ALIASES[$input]}" ]]; then
        echo "${USER_ALIASES[$input]}"
        return 0
    fi

    # Check default aliases
    if [[ -n "${DEFAULT_ALIASES[$input]}" ]]; then
        echo "${DEFAULT_ALIASES[$input]}"
        return 0
    fi

    # No alias found, return input unchanged
    echo "$input"
}

# Add or update an alias
# Usage: alias_set alias_name action_name
alias_set() {
    local alias_name="$1"
    local action_name="$2"

    if [[ -z "$alias_name" || -z "$action_name" ]]; then
        echo "Error: alias_set requires alias_name and action_name" >&2
        return 1
    fi

    # Validate alias name (no dots, no special chars except underscore)
    if [[ ! "$alias_name" =~ ^[a-zA-Z0-9_]+$ ]]; then
        echo "Error: Invalid alias name: $alias_name (use letters, numbers, underscore only)" >&2
        return 1
    fi

    # Update in-memory
    USER_ALIASES["$alias_name"]="$action_name"

    # Update file
    if [[ ! -f "$ALIAS_REGISTRY" ]]; then
        alias_create_default_config
    fi

    # Remove existing alias if present
    if grep -q "^${alias_name}=" "$ALIAS_REGISTRY" 2>/dev/null; then
        # Update existing
        sed -i.bak "s/^${alias_name}=.*/${alias_name}=${action_name}/" "$ALIAS_REGISTRY"
        rm -f "${ALIAS_REGISTRY}.bak"
    else
        # Add new
        echo "${alias_name}=${action_name}" >> "$ALIAS_REGISTRY"
    fi

    echo "Set alias: $alias_name → $action_name" >&2
}

# Remove an alias
# Usage: alias_unset alias_name
alias_unset() {
    local alias_name="$1"

    if [[ -z "$alias_name" ]]; then
        echo "Error: alias_unset requires alias_name" >&2
        return 1
    fi

    # Remove from in-memory
    unset "USER_ALIASES[$alias_name]"

    # Remove from file
    if [[ -f "$ALIAS_REGISTRY" ]]; then
        sed -i.bak "/^${alias_name}=/d" "$ALIAS_REGISTRY"
        rm -f "${ALIAS_REGISTRY}.bak"
    fi

    echo "Removed alias: $alias_name" >&2
}

# List all aliases
# Usage: alias_list [filter]
alias_list() {
    local filter="${1:-}"

    echo "Default Aliases:" >&2
    for alias_name in "${!DEFAULT_ALIASES[@]}"; do
        local action_name="${DEFAULT_ALIASES[$alias_name]}"
        if [[ -z "$filter" || "$alias_name" == *"$filter"* || "$action_name" == *"$filter"* ]]; then
            printf "  %-10s → %s\n" "$alias_name" "$action_name"
        fi
    done | sort

    if [[ ${#USER_ALIASES[@]} -gt 0 ]]; then
        echo ""
        echo "User Aliases:" >&2
        for alias_name in "${!USER_ALIASES[@]}"; do
            local action_name="${USER_ALIASES[$alias_name]}"
            if [[ -z "$filter" || "$alias_name" == *"$filter"* || "$action_name" == *"$filter"* ]]; then
                printf "  %-10s → %s\n" "$alias_name" "$action_name"
            fi
        done | sort
    fi
}

# Check if string is an alias
# Usage: alias_exists alias_name
# Returns: 0 if alias exists, 1 if not
alias_exists() {
    local alias_name="$1"

    [[ -n "${USER_ALIASES[$alias_name]}" ]] || [[ -n "${DEFAULT_ALIASES[$alias_name]}" ]]
}

# Get action name for alias
# Usage: alias_get alias_name
# Returns: Action name or empty if not found
alias_get() {
    local alias_name="$1"

    if [[ -n "${USER_ALIASES[$alias_name]}" ]]; then
        echo "${USER_ALIASES[$alias_name]}"
    elif [[ -n "${DEFAULT_ALIASES[$alias_name]}" ]]; then
        echo "${DEFAULT_ALIASES[$alias_name]}"
    else
        echo ""
    fi
}

# Expand aliases in TAS input
# Usage: alias_expand_tas tas_input
# Returns: Expanded TAS input
alias_expand_tas() {
    local input="$1"

    if [[ -z "$input" ]]; then
        echo "$input"
        return 0
    fi

    # Remove leading / if present
    local prefix=""
    if [[ "$input" == /* ]]; then
        prefix="/"
        input="${input#/}"
    fi

    # Extract action part (before first : or ::)
    local action_part="${input%%:*}"
    local rest="${input#*:}"

    # Check if action has module prefix (contains .)
    if [[ "$action_part" == *.* ]]; then
        # Has module prefix - don't expand
        echo "${prefix}${input}"
        return 0
    fi

    # Resolve alias
    local resolved=$(alias_resolve "$action_part")

    # Reconstruct
    if [[ "$resolved" != "$action_part" ]]; then
        echo "${prefix}${resolved}:${rest}"
    else
        echo "${prefix}${input}"
    fi
}

# Show alias help
# Usage: alias_help
alias_help() {
    cat <<'EOF'
TAS Alias System

Aliases provide shortcuts for common actions.

Usage:
  /q:users              # Expands to /query:users
  /s:message @prod      # Expands to /send:message @prod
  /ls:files             # Expands to /list:files

Managing Aliases:
  alias_list            # List all aliases
  alias_list query      # Filter aliases containing "query"
  alias_set myalias myaction    # Create/update alias
  alias_unset myalias           # Remove alias
  alias_get q                   # Get action for alias "q"

Configuration:
  File: $TETRA_DIR/actions.aliases
  Format: alias=action (one per line)

Default Aliases:
  q=query, s=send, ls=list, rm=delete, cp=copy, mv=move
  cat=read, grep=search, find=locate

Example Custom Alias:
  alias_set d deploy
  /d:config @prod    # Expands to /deploy:config @prod
EOF
}

# Initialize on source
alias_init

# Export functions
export -f alias_init
export -f alias_create_default_config
export -f alias_load
export -f alias_resolve
export -f alias_set
export -f alias_unset
export -f alias_list
export -f alias_exists
export -f alias_get
export -f alias_expand_tas
export -f alias_help
