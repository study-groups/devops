#!/usr/bin/env bash

# RAG Module - Main entry point for RAG tools
# This file is loaded by tmod when you run "tmod load rag"

# RAG Module Environment Variables with proper override guards
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${RAG_DIR:=$TETRA_DIR/rag}"

# RAG Directory Convention under TETRA_DIR (TCS 3.0 + TTM)
RAG_DB_DIR="${RAG_DIR}/db"
RAG_CONFIG_DIR="${RAG_DIR}/config"
RAG_LOGS_DIR="${RAG_DIR}/logs"
RAG_TXNS_DIR="${RAG_DIR}/txns"  # TTM transactions

# RAG Module Management
RAG_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# RAG modules to source (REPL modules loaded on-demand via 'rag repl')
RAG_MODULES=(
    # Core modules (command registry, stages, selector parser)
    "$RAG_MODULE_DIR/core/commands.sh"
    "$RAG_MODULE_DIR/core/stages.sh"
    "$RAG_MODULE_DIR/core/selector.sh"
    "$RAG_MODULE_DIR/core/magicfind.sh"
    "$RAG_MODULE_DIR/core/error.sh"
    # Additional modules
    "$RAG_MODULE_DIR/bash/rag_selector.sh"
    "$RAG_MODULE_DIR/bash/aliases.sh"
    "$RAG_MODULE_DIR/bash/rag_tools.sh"
    "$RAG_MODULE_DIR/rag_extensions.sh"
)

# Source RAG modules
rag_source_modules() {
    local verbose="${1:-false}"
    local failed_modules=()

    for module in "${RAG_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            # Source in a protected context to prevent exit from killing terminal
            if source "$module" 2>/dev/null; then
                [[ "$verbose" == "true" ]] && echo "✓ Sourced: $(basename "$module")"
            else
                local exit_code=$?
                echo "⚠ Failed to source: $(basename "$module") (exit code: $exit_code)" >&2
                failed_modules+=("$(basename "$module")")
            fi
        else
            echo "⚠ Module not found: $(basename "$module")" >&2
            failed_modules+=("$(basename "$module")")
        fi
    done

    # Return success even if some modules failed to prevent terminal crash
    # The failed modules will be reported to stderr
    if [[ ${#failed_modules[@]} -gt 0 ]]; then
        echo "⚠ RAG module loaded with ${#failed_modules[@]} warning(s)" >&2
    fi

    # Load QA module and its submodules so 'a' and 'qq' are available
    # RAG depends on QA for answer retrieval functionality
    if [[ -f "$TETRA_SRC/bash/qa/qa.sh" ]] && [[ "${QA_MODULES_LOADED:-false}" != "true" ]]; then
        source "$TETRA_SRC/bash/qa/qa.sh"
        qa_source_modules 2>/dev/null || true
        export QA_MODULES_LOADED=true
        [[ "$verbose" == "true" ]] && echo "✓ Loaded QA module (enables 'a' and 'qq')"
    fi

    return 0
}

# Initialize RAG environment
rag_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi

    # Create necessary directories
    mkdir -p "$RAG_DB_DIR" "$RAG_CONFIG_DIR" "$RAG_LOGS_DIR" "$RAG_TXNS_DIR"

    # Source modules
    rag_source_modules
}

# Main rag command interface
rag() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: rag <command> [args]

HIERARCHY
  Session → Flow → Evidence → Answer
    └─ Workspace    └─ Mini inquiry   └─ Context    └─ Result

QUICK MODE
  quick "<query>" <files...>    Quick Q&A without creating a flow
  q "<query>" <files...>        Alias for quick

INTERACTIVE MODE
  repl                          Start RAG REPL (recommended)

SESSION COMMANDS
  session create "<desc>"       Create workspace
  session list                  List all sessions
  session resume <id>           Resume session by ID or index
  session status                Show current session

FLOW COMMANDS (Mini Inquiries)
  flow create "<desc>"          Create mini inquiry (10-30 min)
  flow status                   Show current flow
  flow list                     List all flows
  flow resume <id>              Resume flow by ID or index
  flow complete                 Mark complete with outcome

CONTEXT COMMANDS
  select "<query>"              Select evidence using ULM
  assemble                      Assemble context to prompt.mdctx
  submit @qa                    Submit to QA agent

TOOLS
  bundle <files...>             Bundle files into MULTICAT format
  compare <file1> <file2>       Compare files for LLM review
  mc <files...>                 Create MULTICAT from files/directories
  ms <file.mc>                  Split MULTICAT back to files
  mi <file.mc>                  Show MULTICAT file info

System:
  status                        Show RAG system status
  help                          Show help
  init                          Initialize RAG system

Examples:
  # Quick usage (no flow)
  rag quick "how does auth work" src/auth/*.js
  rag bundle src/ --output context.mc
  rag compare old.js new.js "which is better"

  # Flow-based usage (full workflow)
  rag flow start "fix auth timeout"
  rag select "authentication error"
  rag assemble
  rag submit @qa
EOF
        return 0
    fi

    # Initialize if not already done
    rag_init

    shift || true

    case "$action" in
        "quick"|"q")
            rag_quick "$@"
            ;;
        "bundle")
            rag_bundle "$@"
            ;;
        "compare"|"diff")
            rag_compare "$@"
            ;;
        "session")
            local subcommand="${1:-status}"
            shift || true

            # Source session manager
            source "$RAG_SRC/core/session_manager.sh"

            case "$subcommand" in
                "create"|"start")
                    session_create "$@"
                    ;;
                "status")
                    session_status "$@"
                    ;;
                "resume"|"switch")
                    session_resume "$@"
                    ;;
                "list")
                    session_list "$@"
                    ;;
                *)
                    echo "Unknown session subcommand: $subcommand"
                    echo "Available: create, status, resume, list"
                    return 1
                    ;;
            esac
            ;;
        "flow")
            local subcommand="${1:-status}"
            shift || true

            # Source flow manager (TTM)
            source "$RAG_SRC/core/flow_manager_ttm.sh"

            case "$subcommand" in
                "create"|"start")
                    flow_create "$@"
                    ;;
                "status")
                    flow_status "$@"
                    ;;
                "resume")
                    flow_resume "$@"
                    ;;
                "list")
                    flow_list "$@"
                    ;;
                "complete")
                    flow_complete "$@"
                    ;;
                *)
                    echo "Unknown flow subcommand: $subcommand"
                    echo "Available: create, status, resume, list, complete"
                    return 1
                    ;;
            esac
            ;;
        "select")
            source "$RAG_SRC/core/evidence_selector.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            select_evidence "$@"
            ;;
        "evidence")
            local subcmd="${1:-}"
            shift || true

            source "$RAG_SRC/core/evidence_selector.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"

            case "$subcmd" in
                "add")
                    evidence_add "$@"
                    ;;
                "list")
                    local flow_dir="$(get_active_flow_dir)"
                    if [[ -n "$flow_dir" ]] && [[ -d "$flow_dir/ctx/evidence" ]]; then
                        echo "Evidence files:"
                        ls -1 "$flow_dir/ctx/evidence"
                    else
                        echo "No active flow or no evidence files"
                    fi
                    ;;
                *)
                    echo "Usage: rag evidence <add|list> [args]"
                    echo ""
                    echo "  add <selector>   Add evidence file with selector"
                    echo "  list             List evidence files in active flow"
                    echo ""
                    echo "Selector format:"
                    echo "  file                  Whole file"
                    echo "  file::100,200         Lines 100-200"
                    echo "  file::100             From line 100 to EOF"
                    echo "  file::100c,500c       Bytes 100-500"
                    echo "  file#tag1,tag2        With tags"
                    return 1
                    ;;
            esac
            ;;
        "assemble")
            source "$RAG_SRC/core/assembler.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            assemble_ctx "$@"
            ;;
        "plan")
            source "$RAG_SRC/core/assembler.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            plan_ctx "$@"
            ;;
        "submit")
            local target="${1:-}"
            if [[ "$target" != "@qa" ]]; then
                echo "Error: Only @qa target supported currently" >&2
                echo "Usage: rag submit @qa" >&2
                return 1
            fi
            source "$RAG_SRC/core/qa_submit.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            submit_to_qa
            ;;
        "repl"|"r")
            # Load new RAG REPL (integrates bash/repl, TDS, bash/tree)
            if [[ -f "$RAG_SRC/rag_repl.sh" ]]; then
                source "$RAG_SRC/rag_repl.sh"
                rag_repl
            else
                echo "Error: rag_repl.sh not found at $RAG_SRC/" >&2
                return 1
            fi
            ;;
        "example"|"ex")
            mc --example
            ;;
        "mc")
            mc "$@"
            ;;
        "ms")
            ms "$@"
            ;;
        "mi")
            mi "$@"
            ;;
        "status"|"s")
            rag_status
            ;;
        "help"|"h")
            rag_help
            ;;
        "init")
            rag_init
            echo "RAG system initialized"
            ;;
        "mf")
            # MagicFind integration
            rag_mf_command "$@"
            ;;
        "find")
            # Natural language search -> add as evidence
            rag_find_command "$@"
            ;;
        *)
            echo "Unknown command: $action"
            echo "Use 'rag help' for available commands"
            return 1
            ;;
    esac
}

# Helper functions now in core/error.sh

# Quick Q&A without flow
rag_quick() {
    local query=""
    local files=()
    local agent="qa"
    local save_to=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --agent)
                agent="$2"
                shift 2
                ;;
            --save)
                save_to="$2"
                shift 2
                ;;
            *)
                if [[ -z "$query" ]]; then
                    query="$1"
                else
                    files+=("$1")
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$query" ]]; then
        echo "Usage: rag quick <query> [files...] [--agent <name>] [--save <file>]"
        echo ""
        echo "Examples:"
        echo "  rag quick \"how does auth work\" src/auth/*.js"
        echo "  rag quick \"explain parser\" core/parser.sh --agent claude"
        echo "  rag quick \"review code\" src/ --save review.mc"
        return 1
    fi

    if [[ ${#files[@]} -eq 0 ]]; then
        rag_error "$ERR_INVALID_ARG" "No files specified" "Provide files to include in context:
  rag quick \"$query\" file1.sh file2.js
  rag quick \"$query\" src/*.js"
        return $?
    fi

    # Create temporary context
    local temp_mc="/tmp/rag-quick-$$.mc"
    local temp_prompt="/tmp/rag-quick-$$-prompt.md"

    # Generate MULTICAT
    if ! mc "${files[@]}" > "$temp_mc" 2>/dev/null; then
        echo "✗ Failed to create context from files" >&2
        rm -f "$temp_mc"
        return 1
    fi

    # Create prompt with query and context
    cat > "$temp_prompt" <<EOF
# Query

$query

# Context

EOF
    cat "$temp_mc" >> "$temp_prompt"

    # Save or submit
    if [[ -n "$save_to" ]]; then
        mv "$temp_prompt" "$save_to"
        rm -f "$temp_mc"
        echo "✓ Context saved to: $save_to"
        echo "  Files included: ${#files[@]}"
        return 0
    fi

    # Submit to agent
    if [[ "$agent" == "qa" ]] && [[ -f "$RAG_SRC/core/qa_submit.sh" ]]; then
        source "$RAG_SRC/core/qa_submit.sh"
        echo "Submitting to QA agent..."

        # Use qa_query if available, otherwise show instructions
        if command -v qa_query >/dev/null 2>&1; then
            qa_query "$query" < "$temp_prompt"
        else
            echo "✓ Context assembled: $temp_prompt"
            echo "  Copy to LLM manually or configure QA agent"
            return 0
        fi
    else
        echo "✓ Context assembled: $temp_prompt"
        echo "  Files included: ${#files[@]}"
        echo ""
        echo "To submit manually:"
        echo "  cat $temp_prompt | pbcopy    # Copy to clipboard"
        echo "  # Or paste into your LLM interface"
    fi

    # Cleanup
    rm -f "$temp_mc" "$temp_prompt"
}

# Bundle files into MULTICAT without flow
rag_bundle() {
    local output=""
    local exclude=""
    local files=()

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output|-o)
                output="$2"
                shift 2
                ;;
            --exclude|-x)
                exclude="$2"
                shift 2
                ;;
            *)
                files+=("$1")
                shift
                ;;
        esac
    done

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "Usage: rag bundle <files...> [--output <file>] [--exclude <pattern>]"
        echo ""
        echo "Examples:"
        echo "  rag bundle src/*.js --output context.mc"
        echo "  rag bundle src/ --exclude tests/ --output bundle.mc"
        return 1
    fi

    # Set default output
    if [[ -z "$output" ]]; then
        output="bundle-$(date +%Y%m%d-%H%M%S).mc"
    fi

    # Build mc command
    local mc_args=()
    if [[ -n "$exclude" ]]; then
        mc_args+=("-x" "$exclude")
    fi
    mc_args+=("${files[@]}")

    # Generate MULTICAT
    if mc "${mc_args[@]}" > "$output"; then
        local file_count=$(grep -c "^#MULTICAT_START" "$output" 2>/dev/null || echo "0")
        echo "✓ Bundle created: $output"
        echo "  Files included: $file_count"
        echo "  Size: $(wc -c < "$output" | tr -d ' ') bytes"
    else
        echo "✗ Failed to create bundle" >&2
        return 1
    fi
}

# Compare files for LLM review
rag_compare() {
    local file1="$1"
    local file2="$2"
    local context="${3:-Which approach is better?}"
    local output=""

    shift 2 || true
    shift || true

    # Parse remaining arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --output|-o)
                output="$2"
                shift 2
                ;;
            --context|-c)
                context="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    if [[ -z "$file1" ]] || [[ -z "$file2" ]]; then
        echo "Usage: rag compare <file1> <file2> [context] [--output <file>]"
        echo ""
        echo "Examples:"
        echo "  rag compare old.js new.js \"which is better\""
        echo "  rag compare v1/auth.js v2/auth.js --output review.md"
        return 1
    fi

    if [[ ! -f "$file1" ]]; then
        echo "✗ File not found: $file1" >&2
        return 1
    fi

    if [[ ! -f "$file2" ]]; then
        echo "✗ File not found: $file2" >&2
        return 1
    fi

    # Set default output
    if [[ -z "$output" ]]; then
        output="/tmp/rag-compare-$$.md"
    fi

    # Generate comparison document
    cat > "$output" <<EOF
# Comparison Request

$context

## File 1: $file1

\`\`\`
$(cat "$file1")
\`\`\`

## File 2: $file2

\`\`\`
$(cat "$file2")
\`\`\`

## Diff

\`\`\`diff
$(diff -u "$file1" "$file2" || true)
\`\`\`

---

Please analyze these files and provide your assessment.
EOF

    echo "✓ Comparison document created: $output"
    echo "  File 1: $file1"
    echo "  File 2: $file2"
    echo ""
    echo "To submit:"
    echo "  cat $output | pbcopy    # Copy to clipboard"
    echo "  # Or use: rag submit-file $output"
}

rag_status() {
    _tetra_status_header "RAG Tools"

    # Only show environment issues if they exist
    _tetra_status_validate_env "TETRA_DIR" "RAG_DIR" "RAG_SRC"

    # Tools status (compact, one line)
    local tools_status=""
    local rag_tools=(mc ms mi mf qpatch replace)
    for tool in "${rag_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            tools_status+="✓$tool "
        else
            tools_status+="○$tool "
        fi
    done
    echo "Tools: $tools_status"

    # Directory status (compact)
    if [[ -n "$RAG_DIR" ]]; then
        if [[ -d "$RAG_DIR" ]]; then
            local dirs_status=""
            for subdir in db config logs index chunks contexts; do
                if [[ -d "$RAG_DIR/$subdir" ]]; then
                    dirs_status+="✓$subdir "
                else
                    dirs_status+="○$subdir "
                fi
            done
            echo "Dirs:  $dirs_status"

            # Show file counts if directory has content
            local total_files=$(find "$RAG_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [[ $total_files -gt 0 ]]; then
                echo "Files: $total_files total"
            fi
        else
            echo "RAG directory missing: $(_tetra_format_path "$RAG_DIR")"
        fi
    fi
}

rag_help() {
    cat <<'EOF'
RAG Tools Help

NO-FLOW COMMANDS (Quick & Easy):
  rag quick "<query>" <files...>      Quick Q&A without creating a flow
    --agent <name>                    Specify agent (default: qa)
    --save <file>                     Save context instead of submitting

  rag bundle <files...>               Bundle files into MULTICAT format
    --output <file>                   Output file (default: bundle-TIMESTAMP.mc)
    --exclude <pattern>               Exclude files matching pattern

  rag compare <file1> <file2>         Compare files for LLM review
    --context "<text>"                Custom comparison context
    --output <file>                   Output file (default: /tmp/rag-compare-$$.md)

FLOW COMMANDS (Full Workflow):
  rag flow create "<desc>"            Create new flow
  rag flow status                     Show current flow status
  rag flow resume [id]                Resume flow from checkpoint
  rag flow list                       List all flows

EVIDENCE COMMANDS:
  rag evidence add <file>             Add evidence file
  rag evidence list                   List evidence files
  rag select "<query>"                Select evidence using query

CONTEXT ASSEMBLY:
  rag assemble                        Assemble context to prompt.mdctx
  rag submit @qa                      Submit to QA agent

MULTICAT TOOLS:
  rag mc <files>                      Create MULTICAT from files
  rag ms <file.mc>                    Split MULTICAT to files
  rag mi <file.mc>                    Show MULTICAT info
  rag example                         Generate sample MULTICAT format

SYSTEM:
  rag repl                            Start interactive REPL
  rag status                          Show system status
  rag init                            Initialize RAG directories
  rag help                            Show this help

QUICK START - No Flow:
  1. rag quick "how does auth work" src/auth/*.js
  2. Review output or saved file

QUICK START - With Flow:
  1. rag flow create "your question"
  2. rag evidence add file.sh
  3. rag assemble
  4. rag submit @qa

TIPS:
  - Use 'rag quick' for one-off questions
  - Use 'rag flow' for iterative workflows
  - Use 'rag bundle' to prepare context for manual LLM interaction
  - Use 'rag repl' for interactive sessions

Interactive Mode:
  All commands available without 'rag' prefix in REPL
  Example: '/flow create "question"' or 'quick "question" files...'
EOF
}

# Source modules immediately when this file is loaded (protected to prevent terminal crash)
rag_source_modules || true

# Source tab completion
if [[ -f "$RAG_MODULE_DIR/rag_complete.sh" ]]; then
    source "$RAG_MODULE_DIR/rag_complete.sh"
fi

# Export essential module variables
export RAG_SRC RAG_DIR