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

# Load color explorer (needed for colors command)
source "$TDOCS_SRC/ui/color_explorer.sh"

source "$TDOCS_SRC/tdocs_commands.sh"

# Load colored help system
source "$TDOCS_SRC/core/help.sh"

# Load REPL command handlers (extracted for maintainability)
source "$TDOCS_SRC/repl_handlers.sh"

# REPL state (filters, context)
declare -a TDOCS_REPL_MODULES       # Array: (rag midi) or (*) or ("")
declare -a TDOCS_REPL_TYPE          # Array: (spec guide investigation)
declare -a TDOCS_REPL_INTENT        # Array: (define instruct analyze)
declare -a TDOCS_REPL_LIFECYCLE     # Array: (D W S C X)
TDOCS_REPL_LEVEL=""                 # Optional: L0-L4, L3+, L2-L4
TDOCS_REPL_TEMPORAL=""              # Temporal filter: last:7d, etc
TDOCS_REPL_SORT="relevance"         # Sort: relevance|time|grade|level|alpha
TDOCS_REPL_DOC_COUNT=0              # Cached filtered count
TDOCS_REPL_TOTAL_COUNT=0            # Cached absolute total count
TDOCS_REPL_STATE="find"             # State: find|edit|search|filter
TDOCS_REPL_SEARCH_QUERY=""          # Last search query
TDOCS_REPL_CONTEXT="global"         # Context: global or local
TDOCS_REPL_CONTEXT_LOCKED=false     # Lock context (don't auto-switch)

declare -a TDOCS_LAST_LIST          # Array of document paths from last ls

# Static fallback completions (for when tree isn't available)
_tdocs_static_completions() {
    # Commands
    cat <<'EOF'
find
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
colors
help
h
exit
quit
q
EOF

    # Filter options
    echo "all"
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

# ============================================================================
# CONTEXT DETECTION AND MANAGEMENT
# ============================================================================

# Detect context (global vs local)
tdocs_detect_context() {
    # Check for .tdocs directory
    if [[ -d ".tdocs" ]]; then
        echo "local"
        return 0
    fi

    # Check if we're in tetra source tree
    if [[ "$PWD" == "$TETRA_SRC"* ]]; then
        echo "global"
        return 0
    fi

    # Default to global
    echo "global"
}

# Initialize local context
tdocs_init_local() {
    local force="${1:-false}"

    if [[ -d ".tdocs" ]] && [[ "$force" != "true" ]]; then
        echo "Local context already exists in $PWD/.tdocs"
        return 0
    fi

    echo "Initializing local tdocs context in $PWD..."

    # Create directory structure
    mkdir -p .tdocs/db
    mkdir -p .tdocs/cache

    # Create config
    cat > .tdocs/config.json <<'EOF'
{
  "version": "1.0",
  "scan_roots": ["."],
  "exclude_patterns": ["node_modules", ".git", "vendor"],
  "default_lifecycle": "W"
}
EOF

    # Create empty index
    cat > .tdocs/index.json <<'EOF'
{
  "files": {},
  "scan_roots": ["."],
  "last_scan": null
}
EOF

    echo "Local context initialized at .tdocs/"
    echo "Add to .gitignore: echo '.tdocs' >> .gitignore"
}

# Switch context
tdocs_switch_context() {
    local new_context="$1"

    if ! tdoc_valid_context "$new_context"; then
        echo "Invalid context: $new_context (must be 'global' or 'local')" >&2
        return 1
    fi

    # Check if local context exists when switching to local
    if [[ "$new_context" == "local" ]] && ! tdoc_has_local_context; then
        echo "No local context found. Initialize with: tdocs init-local"
        return 1
    fi

    TDOCS_REPL_CONTEXT="$new_context"
    TDOCS_REPL_CONTEXT_LOCKED=true

    # Update TDOCS_DB_DIR based on context
    if [[ "$new_context" == "local" ]]; then
        export TDOCS_DB_DIR="$PWD/.tdocs/db"
    else
        export TDOCS_DB_DIR="$TETRA_DIR/tdocs/db"
    fi

    # Reset counts to force refresh
    TDOCS_REPL_DOC_COUNT=0
    TDOCS_REPL_TOTAL_COUNT=0

    echo "Switched to $new_context context"
}

# Get current context display name
tdocs_get_context_display() {
    tdoc_context_name "$TDOCS_REPL_CONTEXT"
}

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

    # Type filters (join with comma)
    if [[ ${#TDOCS_REPL_TYPE[@]} -gt 0 ]]; then
        local type_list=$(IFS=','; echo "${TDOCS_REPL_TYPE[*]}")
        filter_args+=("--type" "$type_list")
    fi

    # Intent filters (join with comma)
    if [[ ${#TDOCS_REPL_INTENT[@]} -gt 0 ]]; then
        local intent_list=$(IFS=','; echo "${TDOCS_REPL_INTENT[*]}")
        filter_args+=("--intent" "$intent_list")
    fi

    # Lifecycle filters (join with comma)
    if [[ ${#TDOCS_REPL_LIFECYCLE[@]} -gt 0 ]]; then
        local lifecycle_list=$(IFS=','; echo "${TDOCS_REPL_LIFECYCLE[*]}")
        filter_args+=("--lifecycle" "$lifecycle_list")
    fi

    # Level filter (optional)
    [[ -n "$TDOCS_REPL_LEVEL" ]] && filter_args+=("--level" "$TDOCS_REPL_LEVEL")

    # Temporal filter
    [[ -n "$TDOCS_REPL_TEMPORAL" ]] && filter_args+=("--temporal" "$TDOCS_REPL_TEMPORAL")

    # Sort mode
    [[ -n "$TDOCS_REPL_SORT" ]] && filter_args+=("--sort" "$TDOCS_REPL_SORT")

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

# Count total documents in database (absolute count, no filters)
tdocs_count_total() {
    # Count all non-empty .meta files
    if [[ -d "$TDOCS_DB_DIR" ]]; then
        find "$TDOCS_DB_DIR" -name "*.meta" -type f ! -size 0 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Build dynamic prompt with colors
# Format: [context:name total {modules} (type | intent)] [lifecycle] n :sort >
_tdocs_repl_build_prompt() {
    local sort_mode="${TDOCS_REPL_SORT:-relevance}"
    local doc_count="${TDOCS_REPL_DOC_COUNT:-0}"
    local total_count="${TDOCS_REPL_TOTAL_COUNT:-0}"

    # Get context info
    local context="$TDOCS_REPL_CONTEXT"
    local context_name=$(tdocs_get_context_display 2>/dev/null || echo "$context")

    # Update total count (cached - only calculate once at REPL start)
    if [[ "$total_count" -eq 0 ]]; then
        total_count=$(tdocs_count_total 2>/dev/null) || total_count=0
        TDOCS_REPL_TOTAL_COUNT=$total_count
    fi

    # Update filtered doc count (cached - only recalculate if explicitly invalidated)
    # Note: Set TDOCS_REPL_DOC_COUNT=0 in filter commands to invalidate cache
    if [[ "$doc_count" -eq 0 ]] || [[ "${TDOCS_REPL_FORCE_COUNT:-false}" == "true" ]]; then
        doc_count=$(tdocs_count_filtered 2>/dev/null) || doc_count=0
        TDOCS_REPL_DOC_COUNT=$doc_count
        TDOCS_REPL_FORCE_COUNT=false
    fi

    # Get TDS colors (using simplified approach - no readline wrapping)
    local reset=$(tdocs_prompt_reset 2>/dev/null)
    local bracket=$(tdocs_prompt_color "tdocs.prompt.bracket" 2>/dev/null)
    local brace_color=$(tdocs_prompt_color "tdocs.prompt.topic1" 2>/dev/null)       # {} for modules
    local paren_color=$(tdocs_prompt_color "tdocs.prompt.bracket" 2>/dev/null)      # () for type/intent
    local pipe_color=$(tdocs_prompt_color "tdocs.prompt.separator" 2>/dev/null)     # | separator
    local count_color=$(tdocs_prompt_color "tdocs.prompt.count" 2>/dev/null)
    local prompt_arrow=$(tdocs_prompt_color "tdocs.prompt.arrow" 2>/dev/null)
    local module_color=$(tdocs_prompt_color "tdocs.prompt.topic2" 2>/dev/null)      # module names
    local type_color=$(tdocs_prompt_color "tdocs.prompt.level" 2>/dev/null)         # type names
    local intent_color=$(tdocs_prompt_color "tdocs.prompt.temporal" 2>/dev/null)    # intent names
    local auth_color=$(tdocs_prompt_color "tdocs.prompt.filter.core" 2>/dev/null)   # C, S lifecycle
    local working_color=$(tdocs_prompt_color "tdocs.prompt.level" 2>/dev/null)      # W lifecycle
    local temporal_color=$(tdocs_prompt_color "tdocs.prompt.temporal" 2>/dev/null)  # D, X lifecycle

    # DEBUG: Check if colors are working
    if [[ "$TDOCS_DEBUG_PROMPT" == "1" ]]; then
        >&2 echo "DEBUG bracket: [$(echo "$bracket" | cat -v)]"
        >&2 echo "DEBUG count_color: [$(echo "$count_color" | cat -v)]"
        >&2 echo "DEBUG module_color: [$(echo "$module_color" | cat -v)]"
    fi

    # Build module display: {*} or {midi osc} or {}
    local module_display=""
    if [[ ${#TDOCS_REPL_MODULES[@]} -eq 0 ]]; then
        module_display="${brace_color}{${reset}${module_color}*${reset}${brace_color}}${reset}"
    else
        local module_list=$(IFS=' '; echo "${TDOCS_REPL_MODULES[*]}")
        if [[ -n "$module_list" ]]; then
            module_display="${brace_color}{${reset}${module_color}${module_list}${reset}${brace_color}}${reset}"
        else
            module_display="${brace_color}{}${reset}"
        fi
    fi

    # Build type | intent display: () or (spec guide) or (spec | define) or (spec guide | define)
    local type_intent_display=""
    local type_part=""
    local intent_part=""

    # Build type part
    if [[ ${#TDOCS_REPL_TYPE[@]} -gt 0 ]]; then
        local type_list=$(IFS=' '; echo "${TDOCS_REPL_TYPE[*]}")
        type_part="${type_color}${type_list}${reset}"
    fi

    # Build intent part
    if [[ ${#TDOCS_REPL_INTENT[@]} -gt 0 ]]; then
        local intent_list=$(IFS=' '; echo "${TDOCS_REPL_INTENT[*]}")
        intent_part="${intent_color}${intent_list}${reset}"
    fi

    # Combine type and intent with | separator
    if [[ -n "$type_part" && -n "$intent_part" ]]; then
        type_intent_display="${paren_color}(${reset}${type_part} ${pipe_color}|${reset} ${intent_part}${paren_color})${reset}"
    elif [[ -n "$type_part" ]]; then
        type_intent_display="${paren_color}(${reset}${type_part}${paren_color})${reset}"
    elif [[ -n "$intent_part" ]]; then
        type_intent_display="${paren_color}(${reset}${intent_part}${paren_color})${reset}"
    else
        type_intent_display="${paren_color}()${reset}"
    fi

    # Get lifecycle breakdown (C:3 S:12 W:68 D:8) - cached to avoid slow grep
    # Show only non-zero stages
    # IMPORTANT: Only count non-empty .meta files to match total count
    local lifecycle_breakdown=""

    # Only recalculate if cache is empty or total count changed
    if [[ -z "${TDOCS_REPL_LIFECYCLE_BREAKDOWN:-}" ]] || [[ "${TDOCS_REPL_LAST_TOTAL:-0}" != "$total_count" ]]; then
        declare -A lifecycle_counts
        if [[ -d "$TDOCS_DB_DIR" ]]; then
            # Only process non-empty .meta files (matches tdocs_count_total logic)
            while IFS= read -r meta_file; do
                [[ ! -f "$meta_file" ]] && continue
                local lc=$(grep -o '"lifecycle": "[^"]*"' "$meta_file" 2>/dev/null | cut -d'"' -f4 | head -1)
                [[ -z "$lc" ]] && lc="W"  # Default to Working
                ((lifecycle_counts[$lc]++))
            done < <(find "$TDOCS_DB_DIR" -name "*.meta" -type f ! -size 0 2>/dev/null)
        fi

        # Build lifecycle breakdown string (ordered: C, S, W, D, X) - skip zeros
        local lc_parts=()
        [[ -n "${lifecycle_counts[C]}" && "${lifecycle_counts[C]}" -gt 0 ]] && lc_parts+=("${auth_color}C:${lifecycle_counts[C]}${reset}")
        [[ -n "${lifecycle_counts[S]}" && "${lifecycle_counts[S]}" -gt 0 ]] && lc_parts+=("${auth_color}S:${lifecycle_counts[S]}${reset}")
        [[ -n "${lifecycle_counts[W]}" && "${lifecycle_counts[W]}" -gt 0 ]] && lc_parts+=("${working_color}W:${lifecycle_counts[W]}${reset}")
        [[ -n "${lifecycle_counts[D]}" && "${lifecycle_counts[D]}" -gt 0 ]] && lc_parts+=("${temporal_color}D:${lifecycle_counts[D]}${reset}")
        [[ -n "${lifecycle_counts[X]}" && "${lifecycle_counts[X]}" -gt 0 ]] && lc_parts+=("${temporal_color}X:${lifecycle_counts[X]}${reset}")

        if [[ ${#lc_parts[@]} -gt 0 ]]; then
            lifecycle_breakdown=$(IFS=' '; echo "${lc_parts[*]}")
        fi

        # Cache the result
        TDOCS_REPL_LIFECYCLE_BREAKDOWN="$lifecycle_breakdown"
        TDOCS_REPL_LAST_TOTAL="$total_count"
    else
        # Use cached value
        lifecycle_breakdown="$TDOCS_REPL_LIFECYCLE_BREAKDOWN"
    fi

    # Build sort display - show as prefix if not relevance
    local sort_display=""
    if [[ "$sort_mode" != "relevance" ]]; then
        sort_display="${count_color}${sort_mode}:${reset}"
    fi

    # Build context display - color coded by context
    local context_display=""
    if [[ "$context" == "local" ]]; then
        context_display="${module_color}local:${context_name}${reset}"
    else
        context_display="${temporal_color}global:${context_name}${reset}"
    fi

    # Build prompt: [context total {modules} (type | intent)] [lifecycle] n :sort >
    # Examples:
    #   [local:components 15 {*} ()] [W:15] 15 >
    #   [global:tetra 92 {midi osc} (spec)] [W:183] 64 >
    #   [local:src 20 {*} ()] [W:20] 20 >

    REPL_PROMPT="${bracket}[${reset}${context_display} ${count_color}${total_count}${reset} ${module_display} ${type_intent_display}${bracket}] ${reset}${bracket}[${reset}${lifecycle_breakdown}${bracket}] ${reset}${sort_display}${count_color}${doc_count}${reset} ${prompt_arrow}>${reset} "
}

# ============================================================================
# INPUT PROCESSOR
# ============================================================================

_tdocs_repl_process_input() {
    local input="$1"

    # Empty input - show current state
    [[ -z "$input" ]] && return 0

    # Single-key sort toggles (r/t/l/a)
    if [[ "$input" =~ ^[rtla]$ ]]; then
        _tdocs_handle_sort "$input"
        return $?
    fi

    # Shell escape (!cmd)
    if [[ "$input" == !* ]]; then
        _tdocs_handle_shell_escape "${input:1}"
        return $?
    fi

    # Parse input into command and args
    local cmd="${input%% *}"
    local args="${input#* }"
    [[ "$cmd" == "$input" ]] && args=""

    # Command dispatch
    case "$cmd" in
        # Document operations
        ls|list)        tdocs_cmd_ls $args ;;
        view|v)         tdocs_cmd_view $args; return 0 ;;
        search|s)       tdocs_cmd_search $args; return $? ;;
        tag)            tdocs_cmd_tag $args ;;
        add)            tdocs_cmd_add $args; TDOCS_REPL_DOC_COUNT=0 ;;

        # Discovery and filtering
        find)           _tdocs_handle_find "$args"; return $? ;;
        filter|f)       _tdocs_handle_filter "$args"; return $? ;;
        clear)          _tdocs_clear_filters; echo "Filters cleared"; return 2 ;;

        # Scanning and maintenance
        scan)
            tdocs_cmd_scan $args
            TDOCS_REPL_DOC_COUNT=0
            return 2
            ;;
        doctor)
            tdocs_cmd_doctor $args
            TDOCS_REPL_DOC_COUNT=0
            ;;
        audit)          tdocs_cmd_audit ;;
        audit-specs)    tdocs_cmd_audit_specs $args ;;

        # Context management
        context)        _tdocs_handle_context "$args"; return $? ;;
        init-local)     tdocs_init_local "$args" ;;
        env)            tdocs_cmd_env ;;

        # Module and spec operations
        module)         tdocs_cmd_module $args ;;
        spec)           tdocs_cmd_spec $args ;;

        # Evidence (context building)
        evidence|e)     tdocs_cmd_evidence $args ;;

        # Information
        about)          tdocs_cmd_about ;;
        levels)         _tdocs_show_levels_help ;;
        help|h|\?)      tdocs_help_topic $args ;;

        # Demo
        demo)
            local speed="${args:-medium}"
            if [[ -f "$TDOCS_SRC/demo_tdocs.sh" ]]; then
                DEMO_SPEED="$speed" "$TDOCS_SRC/demo_tdocs.sh"
            else
                echo "Demo script not found at $TDOCS_SRC/demo_tdocs.sh"
            fi
            ;;

        # Exit
        exit|quit|q)    return 1 ;;

        # Dynamic command dispatch
        *)
            if [[ -n "$cmd" ]] && declare -f "tdocs_cmd_${cmd}" >/dev/null 2>&1; then
                "tdocs_cmd_${cmd}" $args
            else
                echo "Unknown command: $cmd"
                echo "Type 'help' for available commands, or press TAB for completions"
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

    # Auto-detect context
    TDOCS_REPL_CONTEXT=$(tdocs_detect_context)

    # Set TDOCS_DB_DIR based on context
    if [[ "$TDOCS_REPL_CONTEXT" == "local" ]]; then
        export TDOCS_DB_DIR="$PWD/.tdocs/db"
        # Ensure local context exists
        if [[ ! -d ".tdocs" ]]; then
            echo "Local context detected but not initialized. Initializing..."
            tdocs_init_local
        fi

        # Auto-scan local docs on REPL start
        if [[ -d ".tdocs" ]]; then
            echo "Scanning local docs..."
            tdoc_scan_dir "." >/dev/null 2>&1
            echo "Ready."
        fi
    else
        export TDOCS_DB_DIR="$TETRA_DIR/tdocs/db"
    fi

    # Register the tdocs module with the REPL system
    repl_register_module "tdocs" "ls view search filter tag add scan evidence audit env colors context"

    # Register slash commands
    tdocs_register_commands

    # Set module context for help/completion
    repl_set_module_context "tdocs"

    # Set history base (context-specific)
    if [[ "$TDOCS_REPL_CONTEXT" == "local" ]]; then
        REPL_HISTORY_BASE=".tdocs/repl_history"
    else
        REPL_HISTORY_BASE="${TETRA_DIR}/tdocs/repl_history"
    fi

    # Set execution mode to takeover
    REPL_EXECUTION_MODE="takeover"

    # Tree completion is already registered above
    # No need to set generator here - it's handled by repl_register_tree_completion

    # Override REPL callbacks with tdocs-specific implementations
    repl_build_prompt() { _tdocs_repl_build_prompt "$@"; }
    repl_process_input() { _tdocs_repl_process_input "$@"; }
    export -f repl_build_prompt repl_process_input

    # Show welcome message with context info
    local context_msg=""
    if [[ "$TDOCS_REPL_CONTEXT" == "local" ]]; then
        context_msg="Context: Local project docs in $PWD"
    else
        context_msg="Context: Global tetra docs in $TETRA_DIR/tdocs"
    fi

    cat <<EOF
╔═══════════════════════════════════════════════════════════╗
║           tdocs - Interactive Document Browser            ║
╚═══════════════════════════════════════════════════════════╝

$context_msg

Prompt Format: [context:name total {modules} (type | intent)] [lifecycle] n >
  context    = local:dirname or global:tetra
  total      = all documents in database
  {modules}  = {*} for all, {midi osc} for specific, {} for none
  (type)     = document types: spec, guide, reference, etc.
  (intent)   = what it does: define, instruct, analyze, etc.
  [lifecycle]= breakdown by stage (C/S/W/D/X)
  n          = current filtered count
  time:n     = sort prefix (relevance is default, not shown)

Quick Start:
  ls .                  List current directory (auto-switch to local)
  scan                  Index all documents
  ls                    List all documents
  context local/global  Switch context
  find midi osc spec    Filter by modules and types
  clear                 Clear all filters
  r t a                 Toggle sort: relevance|time|alpha
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
export -f tdocs_detect_context
export -f tdocs_init_local
export -f tdocs_switch_context
export -f tdocs_get_context_display
export -f tdocs_count_filtered
export -f tdocs_count_total
export -f _tdocs_repl_build_prompt
export -f _tdocs_repl_process_input
export -f tdocs_repl

# Launch REPL if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tdocs_repl "$@"
fi
