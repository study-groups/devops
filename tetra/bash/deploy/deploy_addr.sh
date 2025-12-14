#!/usr/bin/env bash
# deploy_addr.sh - Deploy address parsing and validation
# Single source of truth for address syntax
#
# Address format: [org:]target[:pipeline][:{items}] [env]
#
# Examples:
#   docs prod                          - target + env
#   docs:quick prod                    - target:pipeline + env
#   docs:{gdocs} prod                  - target:{items} + env
#   docs:quick:{gdocs} prod            - target:pipeline:{items} + env
#   nodeholder:docs:quick:{gdocs} prod - org:target:pipeline:{items} + env
#
# Items syntax:
#   {gdocs,deploy}  - specific items
#   {!index}        - exclude (all except these)
#   {@guides}       - group reference from [files.guides]
#   ~gdocs          - shorthand for {gdocs}
#   >               - sync-only (quick pipeline)
#   >{gdocs}        - sync-only with specific items

# =============================================================================
# CORE DATA STRUCTURE
# =============================================================================

declare -gA DEPLOY_ADDR=(
    [raw]=""           # Original input string
    [org]=""           # Organization (empty if not specified)
    [target]=""        # Target name (required)
    [pipeline]="default"  # Pipeline name
    [items]=""         # Space-separated item keys
    [items_mode]=""    # "include" | "exclude" | "group" | ""
    [env]=""           # Environment
    [sync_only]=""     # "1" if > prefix
    [toml_path]=""     # Resolved TOML path (after validation)
    [valid]=""         # "1" if validated successfully
    [error]=""         # Error message if validation failed
)

# =============================================================================
# PARSING FUNCTIONS
# =============================================================================

# Reset DEPLOY_ADDR to empty state
deploy_addr_clear() {
    DEPLOY_ADDR=(
        [raw]=""
        [org]=""
        [target]=""
        [pipeline]="default"
        [items]=""
        [items_mode]=""
        [env]=""
        [sync_only]=""
        [toml_path]=""
        [valid]=""
        [error]=""
    )
}

# Debug: display current DEPLOY_ADDR contents
deploy_addr_show() {
    local key
    echo "DEPLOY_ADDR:"
    for key in raw org target pipeline items items_mode env sync_only toml_path valid error; do
        printf "  [%-10s] = %s\n" "$key" "${DEPLOY_ADDR[$key]}"
    done
}

# Parse address string into DEPLOY_ADDR
# Usage: deploy_addr_parse "nodeholder:docs:quick:{gdocs}" "prod"
#    or: deploy_addr_parse "nodeholder:docs:quick:{gdocs} prod"
# Returns: 0 on successful parse, 1 on syntax error
deploy_addr_parse() {
    local input="$1"
    local env_arg="${2:-}"

    deploy_addr_clear
    DEPLOY_ADDR[raw]="$input"

    # Handle env as separate argument or embedded in input
    local address="$input"
    if [[ -n "$env_arg" ]]; then
        DEPLOY_ADDR[env]="$env_arg"
    elif [[ "$input" == *" "* ]]; then
        # Split on space: "docs:quick prod" -> address="docs:quick", env="prod"
        address="${input%% *}"
        DEPLOY_ADDR[env]="${input#* }"
    fi

    # No colons = just target name
    if [[ "$address" != *:* ]]; then
        DEPLOY_ADDR[target]="$address"
        return 0
    fi

    # Count colons (excluding those inside braces)
    local stripped="${address//\{*\}/}"
    local colon_count="${stripped//[^:]}"
    colon_count=${#colon_count}

    local first="${address%%:*}"
    local after_first="${address#*:}"

    if [[ $colon_count -ge 2 ]]; then
        # Could be org:target:pipeline or target:pipeline:{items}
        # Check if first part is an org (exists in orgs dir)
        if [[ -d "$TETRA_DIR/orgs/$first" ]]; then
            # org:target:... format
            DEPLOY_ADDR[org]="$first"
            DEPLOY_ADDR[target]="${after_first%%:*}"
            local rest="${after_first#*:}"
            _deploy_addr_parse_rest "$rest"
        else
            # target:pipeline:... format
            DEPLOY_ADDR[target]="$first"
            _deploy_addr_parse_rest "$after_first"
        fi
    else
        # Simple target:something format (1 colon)
        DEPLOY_ADDR[target]="$first"
        _deploy_addr_parse_rest "$after_first"
    fi

    return 0
}

# Internal: Parse the "rest" part after target (pipeline and/or items)
_deploy_addr_parse_rest() {
    local rest="$1"

    # Sync-only: > or >{items}
    if [[ "$rest" == ">"* ]]; then
        DEPLOY_ADDR[sync_only]="1"
        DEPLOY_ADDR[pipeline]="quick"
        local sync_items="${rest#>}"
        if [[ -n "$sync_items" ]]; then
            _deploy_addr_parse_items "$sync_items"
        fi
        return 0
    fi

    # Tilde shorthand: ~gdocs -> {gdocs}
    if [[ "$rest" == "~"* ]]; then
        DEPLOY_ADDR[items]="${rest#\~}"
        DEPLOY_ADDR[items_mode]="include"
        return 0
    fi

    # Just items: {gdocs}, {!index}, {@guides}
    if [[ "$rest" == "{"*"}" ]]; then
        _deploy_addr_parse_items "$rest"
        return 0
    fi

    # Pipeline with items: pipeline:{items} or pipeline:~item
    if [[ "$rest" == *":{"*"}" ]]; then
        DEPLOY_ADDR[pipeline]="${rest%%:\{*}"
        local items_part="${rest#*:}"
        _deploy_addr_parse_items "$items_part"
        return 0
    fi

    if [[ "$rest" == *":~"* ]]; then
        DEPLOY_ADDR[pipeline]="${rest%%:~*}"
        DEPLOY_ADDR[items]="${rest#*:~}"
        DEPLOY_ADDR[items_mode]="include"
        return 0
    fi

    # Wildcard
    if [[ "$rest" == "*" ]]; then
        DEPLOY_ADDR[pipeline]="default"
        return 0
    fi

    # Just pipeline name
    DEPLOY_ADDR[pipeline]="$rest"
}

# Internal: Parse items syntax from braces
_deploy_addr_parse_items() {
    local raw="$1"

    # Must be brace syntax at this point
    [[ "$raw" != "{"*"}" ]] && return 0

    local inside="${raw#\{}"
    inside="${inside%\}}"

    if [[ "$inside" == "!"* ]]; then
        # Exclusion: {!index,!tut}
        DEPLOY_ADDR[items_mode]="exclude"
        inside="${inside//!/}"
        DEPLOY_ADDR[items]="${inside//,/ }"
    elif [[ "$inside" == "@"* ]]; then
        # Group reference: {@guides}
        DEPLOY_ADDR[items_mode]="group"
        DEPLOY_ADDR[items]="${inside#@}"
    else
        # Regular include: {gdocs,deploy}
        DEPLOY_ADDR[items_mode]="include"
        DEPLOY_ADDR[items]="${inside//,/ }"
    fi
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

# Validate all parsed address components
# Call after deploy_addr_parse
# Returns: 0 if valid, 1 with DEPLOY_ADDR[error] set
deploy_addr_validate() {
    DEPLOY_ADDR[valid]=""
    DEPLOY_ADDR[error]=""

    # 1. Validate org (if specified)
    if [[ -n "${DEPLOY_ADDR[org]}" ]]; then
        deploy_addr_validate_org || return 1
    fi

    # 2. Validate target (required)
    deploy_addr_validate_target || return 1

    # 3. Validate pipeline (if non-default)
    if [[ -n "${DEPLOY_ADDR[pipeline]}" && "${DEPLOY_ADDR[pipeline]}" != "default" ]]; then
        deploy_addr_validate_pipeline || return 1
    fi

    # 4. Validate items (if specified and mode is include)
    if [[ -n "${DEPLOY_ADDR[items]}" && "${DEPLOY_ADDR[items_mode]}" == "include" ]]; then
        deploy_addr_validate_items || return 1
    fi

    DEPLOY_ADDR[valid]="1"
    return 0
}

# Validate org exists
deploy_addr_validate_org() {
    local org="${DEPLOY_ADDR[org]}"
    local org_dir="$TETRA_DIR/orgs/$org"

    if [[ ! -d "$org_dir" ]]; then
        DEPLOY_ADDR[error]="org '$org' not found in \$TETRA_DIR/orgs/"
        # List available orgs
        if [[ -d "$TETRA_DIR/orgs" ]]; then
            local available=$(ls "$TETRA_DIR/orgs" 2>/dev/null | tr '\n' ' ')
            [[ -n "$available" ]] && DEPLOY_ADDR[error]+="\n  available: $available"
        fi
        return 1
    fi
    return 0
}

# Validate target exists and resolve TOML path
deploy_addr_validate_target() {
    local target="${DEPLOY_ADDR[target]}"

    [[ -z "$target" ]] && {
        DEPLOY_ADDR[error]="target name required"
        return 1
    }

    # Determine org to use
    local org="${DEPLOY_ADDR[org]}"
    if [[ -z "$org" ]]; then
        org=$(_deploy_active_org 2>/dev/null)
    fi

    # Special case: CWD target
    if [[ "$target" == "." ]]; then
        if [[ -f "./tetra-deploy.toml" ]]; then
            DEPLOY_ADDR[toml_path]="./tetra-deploy.toml"
            return 0
        else
            DEPLOY_ADDR[error]="no tetra-deploy.toml in current directory"
            return 1
        fi
    fi

    # Look for target TOML
    local targets_dir="$TETRA_DIR/orgs/$org/targets"
    local toml=""

    if [[ -f "$targets_dir/$target/tetra-deploy.toml" ]]; then
        toml="$targets_dir/$target/tetra-deploy.toml"
    elif [[ -f "$targets_dir/${target}.toml" ]]; then
        toml="$targets_dir/${target}.toml"
    fi

    if [[ -z "$toml" ]]; then
        DEPLOY_ADDR[error]="target '$target' not found"
        if [[ -n "$org" && "$org" != "none" ]]; then
            DEPLOY_ADDR[error]+=" for org '$org'"
            DEPLOY_ADDR[error]+="\n  looked in: $targets_dir/"
        fi
        # List available targets
        if [[ -d "$targets_dir" ]]; then
            local available=""
            for f in "$targets_dir"/*.toml "$targets_dir"/*/tetra-deploy.toml; do
                [[ -f "$f" ]] || continue
                local name="${f%/tetra-deploy.toml}"
                name="${name%.toml}"
                name="${name##*/}"
                available+="$name "
            done
            [[ -n "$available" ]] && DEPLOY_ADDR[error]+="\n  available: $available"
        fi
        return 1
    fi

    DEPLOY_ADDR[toml_path]="$toml"
    return 0
}

# Validate pipeline exists in target TOML
deploy_addr_validate_pipeline() {
    local pipeline="${DEPLOY_ADDR[pipeline]}"
    local toml="${DEPLOY_ADDR[toml_path]}"

    [[ -z "$toml" ]] && return 1  # Target not validated yet

    # Check [pipeline] section for this pipeline name
    local found=0
    if awk -v p="$pipeline" '
        /^\[pipeline\]/{in_section=1; next}
        /^\[/{in_section=0}
        in_section && $1 == p {found=1}
        END{exit !found}
    ' "$toml" 2>/dev/null; then
        found=1
    fi

    # Also check [alias] section
    if [[ $found -eq 0 ]]; then
        if awk -v p="$pipeline" '
            /^\[alias\]/{in_section=1; next}
            /^\[/{in_section=0}
            in_section && $1 == p {found=1}
            END{exit !found}
        ' "$toml" 2>/dev/null; then
            found=1
        fi
    fi

    if [[ $found -eq 0 ]]; then
        DEPLOY_ADDR[error]="pipeline '$pipeline' not defined in target '${DEPLOY_ADDR[target]}'"
        # List available pipelines
        local available=$(awk '/^\[pipeline\]/{f=1;next} /^\[/{f=0} f && /=/{print $1}' "$toml" 2>/dev/null | tr '\n' ' ')
        [[ -n "$available" ]] && DEPLOY_ADDR[error]+="\n  available: $available"
        return 1
    fi

    return 0
}

# Validate items exist in target TOML [files] section
deploy_addr_validate_items() {
    local items="${DEPLOY_ADDR[items]}"
    local toml="${DEPLOY_ADDR[toml_path]}"

    [[ -z "$toml" ]] && return 1  # Target not validated yet

    # Get all valid item names from [files] section
    local valid_items=$(awk '/^\[files\]/{f=1;next} /^\[/{f=0} f && /=/{print $1}' "$toml" 2>/dev/null)

    local invalid=()
    for item in $items; do
        if ! echo "$valid_items" | grep -qx "$item"; then
            invalid+=("$item")
        fi
    done

    if [[ ${#invalid[@]} -gt 0 ]]; then
        DEPLOY_ADDR[error]="item(s) not found in [files] section: ${invalid[*]}"
        DEPLOY_ADDR[error]+="\n  valid items: $(echo "$valid_items" | tr '\n' ' ')"
        return 1
    fi

    return 0
}

# =============================================================================
# RESOLUTION HELPERS
# =============================================================================

# Resolve exclusion items: get all items then remove excluded ones
# Requires TOML to be loaded (toml_path set)
deploy_addr_resolve_exclude() {
    local toml="${DEPLOY_ADDR[toml_path]}"
    local excludes="${DEPLOY_ADDR[items]}"

    [[ -z "$toml" ]] && return 1

    # Get all items from TOML
    local all_items=$(_deploy_items_from_toml "$toml" 2>/dev/null)

    local result=""
    for item in $all_items; do
        local skip=0
        for ex in $excludes; do
            [[ "$item" == "$ex" ]] && { skip=1; break; }
        done
        [[ $skip -eq 0 ]] && result+="$item "
    done

    DEPLOY_ADDR[items]="${result% }"
    DEPLOY_ADDR[items_mode]="include"
}

# Resolve group reference: get items from [files.<group>].include
deploy_addr_resolve_group() {
    local toml="${DEPLOY_ADDR[toml_path]}"
    local group="${DEPLOY_ADDR[items]}"

    [[ -z "$toml" ]] && return 1

    local items=$(awk -v g="$group" '
        /^\[files\.'"$group"'\]/{found=1; next}
        /^\[/{found=0}
        found && /^include/ {
            gsub(/.*\[|\]|"/, "")
            gsub(/,/, " ")
            print
        }
    ' "$toml" 2>/dev/null)

    DEPLOY_ADDR[items]="$items"
    DEPLOY_ADDR[items_mode]="include"
}

# =============================================================================
# CONTEXT INTEGRATION
# =============================================================================

# Copy validated address into DEPLOY_CTX_* variables
deploy_addr_to_context() {
    [[ -n "${DEPLOY_ADDR[org]}" ]] && export DEPLOY_CTX_ORG="${DEPLOY_ADDR[org]}"
    [[ -n "${DEPLOY_ADDR[target]}" ]] && export DEPLOY_CTX_TARGET="${DEPLOY_ADDR[target]}"
    [[ -n "${DEPLOY_ADDR[pipeline]}" ]] && export DEPLOY_CTX_PIPELINE="${DEPLOY_ADDR[pipeline]}"
    [[ -n "${DEPLOY_ADDR[env]}" ]] && export DEPLOY_CTX_ENV="${DEPLOY_ADDR[env]}"
}

# Populate DEPLOY_ADDR from current context
deploy_addr_from_context() {
    DEPLOY_ADDR[org]="${DEPLOY_CTX_ORG:-}"
    DEPLOY_ADDR[target]="${DEPLOY_CTX_TARGET:-}"
    DEPLOY_ADDR[pipeline]="${DEPLOY_CTX_PIPELINE:-default}"
    DEPLOY_ADDR[env]="${DEPLOY_CTX_ENV:-}"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f deploy_addr_clear deploy_addr_show deploy_addr_parse
export -f _deploy_addr_parse_rest _deploy_addr_parse_items
export -f deploy_addr_validate deploy_addr_validate_org deploy_addr_validate_target
export -f deploy_addr_validate_pipeline deploy_addr_validate_items
export -f deploy_addr_resolve_exclude deploy_addr_resolve_group
export -f deploy_addr_to_context deploy_addr_from_context
