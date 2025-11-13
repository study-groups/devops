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
# Format: [total {modules} (type | intent)] [lifecycle] n :sort >
_tdocs_repl_build_prompt() {
    local sort_mode="${TDOCS_REPL_SORT:-relevance}"
    local doc_count="${TDOCS_REPL_DOC_COUNT:-0}"
    local total_count="${TDOCS_REPL_TOTAL_COUNT:-0}"

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

    # Build prompt: [total {modules} (type | intent)] [lifecycle] n :sort >
    # Examples:
    #   [92 {*} ()] [] 92 >
    #   [92 {midi osc} (spec)] [W:183] 64 >
    #   [92 {midi} (spec | define)] [C:3 S:12] 15 time:15 >

    REPL_PROMPT="${bracket}[${reset}${count_color}${total_count}${reset} ${module_display} ${type_intent_display}${bracket}] ${reset}${bracket}[${reset}${lifecycle_breakdown}${bracket}] ${reset}${sort_display}${count_color}${doc_count}${reset} ${prompt_arrow}>${reset} "
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
            return 0  # Don't exit REPL on error
            ;;

        # Search
        search|s)
            tdocs_cmd_search $args
            local search_result=$?
            # Return the result code from search (2 = prompt rebuild)
            return $search_result
            ;;

        # Find - smart discovery (modules, types, or search)
        find)
            local find_args=($args)

            if [[ ${#find_args[@]} -eq 0 ]]; then
                # No args - show current filters
                echo "Find mode: showing current context"
                echo "Modules: ${TDOCS_REPL_MODULES[*]:-all}"
                echo "Types: ${TDOCS_REPL_TYPE[*]:-all}"
                echo ""
                echo "Usage: find <modules/types/query...>"
                echo "  find all            - Reset filters, show all documents"
                echo "  find midi           - Filter by midi module"
                echo "  find midi osc       - Filter by midi and osc modules"
                echo "  find spec guide     - Filter by spec and guide types"
                return 0
            fi

            # Handle special cases
            if [[ "${find_args[0]}" == "all" ]] || [[ "${find_args[0]}" == "clear" ]] || [[ "${find_args[0]}" == "reset" ]]; then
                # Reset all filters
                TDOCS_REPL_MODULES=()
                TDOCS_REPL_TYPE=()
                TDOCS_REPL_INTENT=()
                TDOCS_REPL_LIFECYCLE=()
                TDOCS_REPL_LEVEL=""
                TDOCS_REPL_TEMPORAL=""
                TDOCS_REPL_DOC_COUNT=0
                TDOCS_REPL_STATE="find"
                TDOCS_REPL_SEARCH_QUERY=""
                echo "Filters cleared - showing all documents"
                echo ""
                tdocs_cmd_ls
                return 2  # Signal prompt rebuild
            fi

            # Detect if args are module names, types, or search query
            local modules=()
            local types=()
            local search_terms=()

            # Known modules and types for detection
            local known_modules="rag midi tdocs repl tcurses tree tds tsm boot game org tgp osc"
            local known_types="spec guide investigation reference plan summary scratch bug-fix refactor"

            for arg in "${find_args[@]}"; do
                # Normalize plural forms: remove trailing 's' if it makes a known type
                local singular="$arg"
                if [[ "$arg" == *s ]] && [[ " $known_types " == *" ${arg%s} "* ]]; then
                    singular="${arg%s}"
                fi

                if [[ " $known_modules " == *" $arg "* ]]; then
                    modules+=("$arg")
                elif [[ " $known_types " == *" $singular "* ]]; then
                    types+=("$singular")
                else
                    search_terms+=("$arg")
                fi
            done

            # Apply filters and/or search
            local did_filter=false
            if [[ ${#modules[@]} -gt 0 ]]; then
                TDOCS_REPL_MODULES=("${modules[@]}")
                TDOCS_REPL_DOC_COUNT=0
                TDOCS_REPL_STATE="find"
                echo "Find: modules = ${modules[*]}"
                did_filter=true
            fi

            if [[ ${#types[@]} -gt 0 ]]; then
                TDOCS_REPL_TYPE=("${types[@]}")
                TDOCS_REPL_DOC_COUNT=0
                TDOCS_REPL_STATE="find"
                echo "Find: types = ${types[*]}"
                did_filter=true
            fi

            if [[ ${#search_terms[@]} -gt 0 ]]; then
                # Perform search
                local query="${search_terms[*]}"
                tdocs_cmd_search "$query"
                return $?
            fi

            # If we filtered, show the results
            if [[ "$did_filter" == true ]]; then
                echo ""
                tdocs_cmd_ls
            fi

            return 2  # Signal prompt rebuild
            ;;

        # Filtering (legacy support)
        filter|f)
            local filter_args=($args)
            local filter_type="${filter_args[0]}"
            case "$filter_type" in
                module|mod|m)
                    # Support: filter module rag midi tdocs OR filter module rag,midi,tdocs
                    local module_spec="${filter_args[@]:1}"
                    # Replace spaces with commas if not already comma-separated
                    if [[ ! "$module_spec" =~ , ]]; then
                        module_spec="${module_spec// /,}"
                    fi
                    IFS=',' read -ra TDOCS_REPL_MODULES <<< "$module_spec"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: modules = ${TDOCS_REPL_MODULES[*]}"
                    return 2
                    ;;
                type|t)
                    # Support: filter type spec guide OR filter type spec,guide
                    local type_spec="${filter_args[@]:1}"
                    if [[ ! "$type_spec" =~ , ]]; then
                        type_spec="${type_spec// /,}"
                    fi
                    IFS=',' read -ra TDOCS_REPL_TYPE <<< "$type_spec"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: type = ${TDOCS_REPL_TYPE[*]}"
                    return 2
                    ;;
                intent|i)
                    # Support: filter intent define instruct
                    local intent_spec="${filter_args[@]:1}"
                    if [[ ! "$intent_spec" =~ , ]]; then
                        intent_spec="${intent_spec// /,}"
                    fi
                    IFS=',' read -ra TDOCS_REPL_INTENT <<< "$intent_spec"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: intent = ${TDOCS_REPL_INTENT[*]}"
                    return 2
                    ;;
                lifecycle|lc)
                    # Support: filter lifecycle C S W
                    local lifecycle_spec="${filter_args[@]:1}"
                    if [[ ! "$lifecycle_spec" =~ , ]]; then
                        lifecycle_spec="${lifecycle_spec// /,}"
                    fi
                    IFS=',' read -ra TDOCS_REPL_LIFECYCLE <<< "$lifecycle_spec"
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filter: lifecycle = ${TDOCS_REPL_LIFECYCLE[*]}"
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
                clear|reset)
                    TDOCS_REPL_MODULES=()
                    TDOCS_REPL_TYPE=()
                    TDOCS_REPL_INTENT=()
                    TDOCS_REPL_LIFECYCLE=()
                    TDOCS_REPL_LEVEL=""
                    TDOCS_REPL_TEMPORAL=""
                    TDOCS_REPL_DOC_COUNT=0
                    echo "Filters cleared"
                    return 2
                    ;;
                *)
                    cat <<'EOF'
Usage: filter [module|type|intent|lifecycle|level|temporal|clear] <value...>
       filter module rag midi     filter type spec guide
       filter intent define       filter lifecycle C S W
       filter level L3+           filter last:7d
       filter clear               clear all filters

EASIER: Use find command instead!
       find all                   show all documents (reset filters)
       find midi osc              find midi and osc modules
       find spec guide            find specs and guides
       clear                      alias for filter clear

Type: spec guide investigation reference plan summary scratch
Intent: define instruct analyze document propose track
Lifecycle: D (draft) W (working) S (stable) C (canonical) X (archived)
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

        # Scan for documents
        scan)
            tdocs_cmd_scan $args
            # Reset document count cache after scan
            TDOCS_REPL_DOC_COUNT=0
            return 2  # Signal prompt refresh
            ;;

        # Doctor (health check)
        doctor)
            tdocs_cmd_doctor $args
            # Reset document count cache after doctor fixes
            TDOCS_REPL_DOC_COUNT=0
            ;;

        # Add document metadata
        add)
            tdocs_cmd_add $args
            # Reset document count cache after adding
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
            TDOCS_REPL_MODULES=()
            TDOCS_REPL_TYPE=()
            TDOCS_REPL_INTENT=()
            TDOCS_REPL_LIFECYCLE=()
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
    repl_register_module "tdocs" "ls view search filter tag add scan evidence audit env colors"

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

Prompt Format: [total {modules} (type | intent)] [lifecycle] n >
  total      = all documents in database
  {modules}  = {*} for all, {midi osc} for specific, {} for none
  (type)     = document types: spec, guide, reference, etc.
  (intent)   = what it does: define, instruct, analyze, etc.
  [lifecycle]= breakdown by stage (C/S/W/D/X)
  n          = current filtered count
  time:n     = sort prefix (relevance is default, not shown)

Quick Start:
  scan                  Index all documents
  ls                    List all documents
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
export -f tdocs_count_filtered
export -f tdocs_count_total
export -f _tdocs_repl_build_prompt
export -f _tdocs_repl_process_input
export -f tdocs_repl

# Launch REPL if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    tdocs_repl "$@"
fi
