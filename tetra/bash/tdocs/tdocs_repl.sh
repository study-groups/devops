#!/usr/bin/env bash
# tdocs REPL - Interactive document browser

# Global check
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    echo "Run: source ~/tetra/tetra.sh" >&2
    exit 1
fi

# Dependencies - source REPL first
source "$TETRA_SRC/bash/repl/repl.sh"

# Set module name for completion
REPL_MODULE_NAME="tdocs"

# Ensure core tdocs is loaded (with wrapper functions and TDS tokens)
if ! declare -F tdocs_ls_docs >/dev/null 2>&1; then
    source "$TDOCS_SRC/tdocs.sh"
fi

# Always load tdocs tokens (in case tdocs was already loaded before tokens were added)
source "$TDOCS_SRC/ui/tdocs_tokens.sh"

source "$TDOCS_SRC/tdocs_commands.sh"

# Load colored help system
source "$TDOCS_SRC/core/help.sh"

# REPL state (filters, context)
declare -a TDOCS_REPL_MODULES       # Array: (rag midi) or (*) or ("")
declare -a TDOCS_REPL_AUTHORITY     # Array: (canonical stable working)
declare -a TDOCS_REPL_TYPE          # Array: (specification guide)
TDOCS_REPL_LEVEL=""                 # Optional: L0-L4, L3+, L2-L4
TDOCS_REPL_TEMPORAL=""              # Temporal filter: last:7d, etc
TDOCS_REPL_SORT="relevance"         # Sort: relevance|time|authority|grade
TDOCS_REPL_DOC_COUNT=0              # Cached count
TDOCS_REPL_STATE="find"             # State: find|edit|search|filter

# Deprecated (keep for backward compat)
TDOCS_REPL_CATEGORY=""              # Deprecated: mapped to authority
TDOCS_REPL_MODULE=""                # Deprecated: use TDOCS_REPL_MODULES array

declare -a TDOCS_LAST_LIST          # Array of document paths from last ls

# Static fallback completions (for when tree isn't available)
_tdocs_static_completions() {
    # Commands
    cat <<'EOF'
ls
list
view
v
search
s
filter
f
tag
init
discover
doctor
evidence
e
audit
env
about
help
h
exit
quit
q
EOF

    # Filter options
    echo "core"
    echo "other"
    echo "module"
    echo "clear"
    echo "reset"

    # Flags
    cat <<'EOF'
--core
--other
--module
--preview
--tags
--pager
--meta-only
--raw
--type
--auto-init
--rebuild
EOF

    # Document types
    cat <<'EOF'
spec
guide
reference
bug-fix
refactor
plan
summary
investigation
EOF

    # Dynamic: modules from database
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'

        # Document basenames
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.path' {} \; 2>/dev/null | \
            grep -v '^null$' | \
            xargs -n1 basename 2>/dev/null
    fi
}

# Ensure tdocs tree is initialized
if command -v _tdocs_build_help_tree >/dev/null 2>&1; then
    _tdocs_build_help_tree 2>/dev/null || true
fi

# Register tree-based completion with static fallback
repl_register_tree_completion "help.tdocs" "_tdocs_static_completions"

# Count filtered documents
tdocs_count_filtered() {
    local count=0

    # Build filter args from new array-based filters
    local filter_args=()

    # Module filters (join with comma)
    if [[ ${#TDOCS_REPL_MODULES[@]} -gt 0 ]]; then
        local module_list=$(IFS=','; echo "${TDOCS_REPL_MODULES[*]}")
        filter_args+=("--module" "$module_list")
    fi

    # Authority filters (join with comma)
    if [[ ${#TDOCS_REPL_AUTHORITY[@]} -gt 0 ]]; then
        local authority_list=$(IFS=','; echo "${TDOCS_REPL_AUTHORITY[*]}")
        filter_args+=("--authority" "$authority_list")
    fi

    # Type filters (join with comma)
    if [[ ${#TDOCS_REPL_TYPE[@]} -gt 0 ]]; then
        local type_list=$(IFS=','; echo "${TDOCS_REPL_TYPE[*]}")
        filter_args+=("--type" "$type_list")
    fi

    # Level filter (optional)
    [[ -n "$TDOCS_REPL_LEVEL" ]] && filter_args+=("--level" "$TDOCS_REPL_LEVEL")

    # Temporal filter
    [[ -n "$TDOCS_REPL_TEMPORAL" ]] && filter_args+=("--temporal" "$TDOCS_REPL_TEMPORAL")

    # Sort mode
    [[ -n "$TDOCS_REPL_SORT" ]] && filter_args+=("--sort" "$TDOCS_REPL_SORT")

    # Backward compat: old category/module fields
    [[ -n "$TDOCS_REPL_CATEGORY" ]] && filter_args+=("--$TDOCS_REPL_CATEGORY")
    [[ -n "$TDOCS_REPL_MODULE" ]] && filter_args+=("--module" "$TDOCS_REPL_MODULE")

    # Count documents by parsing the "Found X document(s):" line
    if command -v tdocs_ls_docs >/dev/null 2>&1; then
        local output=$(tdocs_ls_docs "${filter_args[@]}" 2>/dev/null | head -1)
        # Parse "Found X document(s):" or "No documents found"
        if [[ "$output" =~ Found\ ([0-9]+)\ document ]]; then
            count="${BASH_REMATCH[1]}"
        elif [[ "$output" == "No documents found" ]]; then
            count=0
        fi
    fi

    echo "$count"
}

# Build dynamic prompt with colors
# Format: [module-set × filter-set → count] state >
_tdocs_repl_build_prompt() {
    local sort_mode="${TDOCS_REPL_SORT:-relevance}"
    local doc_count="${TDOCS_REPL_DOC_COUNT:-0}"
    local state="${TDOCS_REPL_STATE:-find}"

    # Update doc count
    if [[ "$doc_count" -eq 0 ]]; then
        doc_count=$(tdocs_count_filtered 2>/dev/null) || doc_count=0
        TDOCS_REPL_DOC_COUNT=$doc_count
    fi

    # Get TDS colors
    local reset=$(tdocs_prompt_reset)
    local bracket=$(tdocs_prompt_color "tdocs.prompt.bracket")
    local pipe=$(tdocs_prompt_color "tdocs.prompt.separator")
    local cross=$(tdocs_prompt_color "tdocs.prompt.separator")  # × symbol
    local arrow=$(tdocs_prompt_color "tdocs.prompt.arrow.pipe")
    local count_color=$(tdocs_prompt_color "tdocs.prompt.count")
    local prompt_arrow=$(tdocs_prompt_color "tdocs.prompt.arrow")
    local state_color=$(tdocs_prompt_color "tdocs.prompt.state")
    local module_color=$(tdocs_prompt_color "tdocs.prompt.topic2")
    local auth_color=$(tdocs_prompt_color "tdocs.prompt.filter.core")
    local type_color=$(tdocs_prompt_color "tdocs.prompt.level")
    local temporal_color=$(tdocs_prompt_color "tdocs.prompt.temporal")

    # Build module set display
    local modules=""
    if [[ ${#TDOCS_REPL_MODULES[@]} -eq 0 ]]; then
        modules=""
    elif [[ "${TDOCS_REPL_MODULES[0]}" == "*" ]]; then
        modules="${module_color}*${reset}"
    elif [[ "${TDOCS_REPL_MODULES[0]}" == "" ]]; then
        modules="${module_color}sys${reset}"
    elif [[ ${#TDOCS_REPL_MODULES[@]} -eq 1 ]]; then
        modules="${module_color}${TDOCS_REPL_MODULES[0]}${reset}"
    else
        # Multiple modules: (rag|midi|tdocs)
        local mod_list=$(IFS='|'; echo "${TDOCS_REPL_MODULES[*]}")
        modules="${module_color}(${mod_list})${reset}"
    fi

    # Build filter set display
    local filters=()

    # Authority filters
    if [[ ${#TDOCS_REPL_AUTHORITY[@]} -gt 0 ]]; then
        for auth in "${TDOCS_REPL_AUTHORITY[@]}"; do
            filters+=("${auth_color}${auth}${reset}")
        done
    fi

    # Type filters
    if [[ ${#TDOCS_REPL_TYPE[@]} -gt 0 ]]; then
        for typ in "${TDOCS_REPL_TYPE[@]}"; do
            filters+=("${type_color}${typ}${reset}")
        done
    fi

    # Level filter (optional)
    if [[ -n "$TDOCS_REPL_LEVEL" ]]; then
        local level_display="$TDOCS_REPL_LEVEL"
        [[ ! "$level_display" =~ ^L ]] && level_display="L${level_display}"
        filters+=("${type_color}${level_display}${reset}")
    fi

    # Temporal filter
    if [[ -n "$TDOCS_REPL_TEMPORAL" ]]; then
        filters+=("${temporal_color}${TDOCS_REPL_TEMPORAL}${reset}")
    fi

    # Join filters with spaces
    local filter_str=""
    if [[ ${#filters[@]} -gt 0 ]]; then
        filter_str="${filters[*]}"
    fi

    # State display with sort mode
    local state_display="$state"
    if [[ "$sort_mode" != "relevance" ]]; then
        state_display="${state}:${sort_mode}"
    fi

    # Build prompt based on what's active
    if [[ -n "$modules" && -n "$filter_str" ]]; then
        # Both modules and filters: [rag × canonical spec → 3] find >
        REPL_PROMPT="${bracket}[${reset}${modules} ${cross}×${reset} ${filter_str} ${arrow}→${reset} ${count_color}${doc_count}${reset}${bracket}]${reset} ${state_color}${state_display}${reset} ${prompt_arrow}>${reset} "
    elif [[ -n "$modules" ]]; then
        # Only modules: [rag → 12] find >
        REPL_PROMPT="${bracket}[${reset}${modules} ${arrow}→${reset} ${count_color}${doc_count}${reset}${bracket}]${reset} ${state_color}${state_display}${reset} ${prompt_arrow}>${reset} "
    elif [[ -n "$filter_str" ]]; then
        # Only filters: [canonical spec → 5] find >
        REPL_PROMPT="${bracket}[${reset}${filter_str} ${arrow}→${reset} ${count_color}${doc_count}${reset}${bracket}]${reset} ${state_color}${state_display}${reset} ${prompt_arrow}>${reset} "
    else
        # No filters: [47] find >
        REPL_PROMPT="${bracket}[${reset}${count_color}${doc_count}${reset}${bracket}]${reset} ${state_color}${state_display}${reset} ${prompt_arrow}>${reset} "
    fi
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_tdocs_repl_process_input() {
    local input="$1"

    # Empty input - show current state
    if [[ -z "$input" ]]; then
        return 0
    fi

    # Single-key sort toggles (r/t/l/a for relevance/time/level/alpha)
    if [[ "$input" =~ ^[rtla]$ ]]; then
        case "$input" in
            r)
                TDOCS_REPL_SORT="relevance"
                echo "Sort: relevance (recency + level + context)"
                return 2  # Signal prompt refresh
                ;;
            t)
                TDOCS_REPL_SORT="time"
                echo "Sort: time (newest first)"
                return 2
                ;;
            l)
                TDOCS_REPL_SORT="level"
                echo "Sort: level (highest completeness first)"
                return 2
                ;;
            a)
                TDOCS_REPL_SORT="alpha"
                echo "Sort: alphabetical"
                return 2
                ;;
        esac
    fi

    # Shell command (!cmd for shell escape)
    if [[ "$input" == !* ]]; then
        eval "${input:1}"
        return 0
    fi

    # Parse input into command and args
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$cmd" == "$input" ]] && args=""

    # Parse command (takeover mode - no / prefix needed)
    case "$cmd" in
        # Document listing
        ls|list)
            tdocs_cmd_ls $args
            ;;

        # View document
        view|v)
            tdocs_cmd_view $args
            ;;

        # Search
        search|s)
            tdocs_cmd_search $args
            ;;

        # Filtering
        filter|f)
            local filter_args=($args)
            local filter_type="${filter_args[0]}"
            case "$filter_type" in
                module|mod|m)
                    # Support: filter module rag,midi,tdocs
                    IFS=',' read -ra TDOCS_REPL_MODULES <<< "${filter_args[1]}"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: modules = ${TDOCS_REPL_MODULES[*]}"
                    return 2
                    ;;
                authority|auth|a)
                    # Support: filter authority canonical,stable
                    IFS=',' read -ra TDOCS_REPL_AUTHORITY <<< "${filter_args[1]}"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: authority = ${TDOCS_REPL_AUTHORITY[*]}"
                    return 2
                    ;;
                type|t)
                    # Support: filter type spec,guide
                    IFS=',' read -ra TDOCS_REPL_TYPE <<< "${filter_args[1]}"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: type = ${TDOCS_REPL_TYPE[*]}"
                    return 2
                    ;;
                level|l)
                    TDOCS_REPL_LEVEL="${filter_args[1]}"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: level = ${filter_args[1]}"
                    return 2
                    ;;
                last:*|recent:*|time:*|date:*)
                    # Temporal filter
                    TDOCS_REPL_TEMPORAL="${filter_args[0]}"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: temporal = ${filter_args[0]}"
                    return 2
                    ;;
                # Backward compat
                core)
                    TDOCS_REPL_AUTHORITY=(canonical)
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: authority = canonical (deprecated: use 'filter authority canonical')"
                    return 2
                    ;;
                other)
                    TDOCS_REPL_AUTHORITY=(working)
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: authority = working (deprecated: use 'filter authority working')"
                    return 2
                    ;;
                clear|reset)
                    TDOCS_REPL_MODULES=()
                    TDOCS_REPL_AUTHORITY=()
                    TDOCS_REPL_TYPE=()
                    TDOCS_REPL_LEVEL=""
                    TDOCS_REPL_TEMPORAL=""
                    TDOCS_REPL_CATEGORY=""
                    TDOCS_REPL_MODULE=""
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filters cleared"
                    return 2
                    ;;
                *)
                    cat <<'EOF'
Usage: filter [module|authority|type|level|temporal|clear] <value>
       filter module rag,midi    filter authority canonical
       filter type spec,guide    filter last:7d

Authority: canonical stable working draft stale archived
Type: specification guide reference plan investigation scratch
Module: rag midi tdocs repl (or * for all, "" for system)
Level: L0-L4, L3+, L2-L4
Temporal: last:7d last:2w last:1m  recent:week  time:2025-11-01
EOF
                    ;;
            esac
            ;;

        # Tagging
        tag)
            tdocs_cmd_tag $args
            ;;

        # Discovery
        discover)
            tdocs_cmd_discover $args
            # Reset document count cache after discovery
            TDOCS_REPL_DOC_COUNT=0
            ;;

        # Doctor (health check)
        doctor)
            tdocs_cmd_doctor $args
            # Reset document count cache after doctor fixes
            TDOCS_REPL_DOC_COUNT=0
            ;;

        # Initialize
        init)
            tdocs_cmd_init $args
            # Reset document count cache after initialization
            TDOCS_REPL_DOC_COUNT=0
            ;;

        # Evidence (context building)
        evidence|e)
            tdocs_cmd_evidence $args
            ;;

        # Environment info
        env)
            tdocs_cmd_env
            ;;

        # Audit
        audit)
            tdocs_cmd_audit
            ;;

        # Module commands
        module)
            tdocs_cmd_module $args
            ;;

        spec)
            tdocs_cmd_spec $args
            ;;

        audit-specs)
            tdocs_cmd_audit_specs $args
            ;;

        # About
        about)
            tdocs_cmd_about
            ;;

        # Demo
        demo)
            # Run demo script
            local speed="${args:-medium}"
            if [[ -f "$TDOCS_SRC/demo_tdocs.sh" ]]; then
                DEMO_SPEED="$speed" "$TDOCS_SRC/demo_tdocs.sh"
            else
                echo "Demo script not found at $TDOCS_SRC/demo_tdocs.sh"
            fi
            ;;

        # Levels legend
        levels)
            cat <<'EOF'
Completeness Levels:
  L0 None      No documentation or basic files only
  L1 Minimal   Basic README, minimal docs
  L2 Working   Functional with basic integration
  L3 Complete  Full docs, tests, examples
  L4 Exemplar  Gold standard with specs, full integration

Examples: filter level L3+    filter level L2-L4
EOF
            ;;

        # Clear filters (alias for filter clear)
        clear)
            TDOCS_REPL_CATEGORY=""
            TDOCS_REPL_MODULE=""
            TDOCS_REPL_LEVEL=""
            TDOCS_REPL_TEMPORAL=""
            TDOCS_REPL_DOC_COUNT=0
            echo "Filters cleared"
            return 2  # Signal prompt refresh
            ;;

        # Help
        help|h|\?)
            tdocs_help_topic $args
            ;;

        # Exit
        exit|quit|q)
            return 1  # Signal exit
            ;;

        # Unknown command
        *)
            # Try to dispatch via slash commands if registered
            if [[ -n "$cmd" ]]; then
                # Check if it's a registered slash command
                if declare -f "tdocs_cmd_${cmd}" >/dev/null 2>&1; then
                    "tdocs_cmd_${cmd}" $args
                else
                    echo "Unknown command: $cmd"
                    echo "Type 'help' for available commands, or press TAB for completions"
                    return 0
                fi
            fi
            ;;
    esac
}

# Main REPL entry point
tdocs_repl() {
    # Initialize tdocs module if not already done
    if ! command -v tdocs_module_init >/dev/null 2>&1; then
        echo "Error: tdocs module not loaded" >&2
        echo "Run: tmod load tdocs" >&2
        return 1
    fi

    # Ensure module is initialized
    tdocs_module_init 2>/dev/null || true

    # Register the tdocs module with the REPL system
    repl_register_module "tdocs" "ls view search filter tag init discover evidence audit env"

    # Register slash commands
    tdocs_register_commands

    # Set module context for help/completion
    repl_set_module_context "tdocs"

    # Set history base
    REPL_HISTORY_BASE="${TETRA_DIR}/tdocs/repl_history"

    # Set execution mode to takeover
    REPL_EXECUTION_MODE="takeover"

    # Tree completion is already registered above
    # No need to set generator here - it's handled by repl_register_tree_completion

    # Override REPL callbacks with tdocs-specific implementations
    repl_build_prompt() { _tdocs_repl_build_prompt "$@"; }
    repl_process_input() { _tdocs_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Show welcome message
    cat <<'EOF'
╔═══════════════════════════════════════════════════════════╗
║           tdocs - Interactive Document Browser            ║
╚═══════════════════════════════════════════════════════════╝

Takeover Mode: Direct commands (no shell pass-through)

Quick Start:
  demo                  Run interactive demo (start here!)
  discover --auto-init  Auto-index all documents
  ls                    List all documents
  module <name>         Show module documentation
  filter core           Show only core documents
  help                  Show all commands

✓ Native TAB completion enabled

Type 'help' for all commands, 'exit' to quit
EOF
    echo ""

    # Run REPL in takeover mode (full REPL control)
    repl_run

    # Cleanup
    unset -f repl_build_prompt repl_process_input

    echo ""
    echo "Goodbye!"
    echo ""
}

# Export functions
export -f tdocs_count_filtered
export -f _tdocs_repl_build_prompt
export -f _tdocs_repl_process_input
export -f tdocs_repl

# Launch REPL if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tdocs_repl "$@"
fi
