#!/usr/bin/env bash
# commands.sh - Unified RAG command definitions
# Single source of truth for commands, subcommands, options, and metadata
#
# Used by: rag.sh, rag_complete.sh, rag_repl.sh

# Prevent double-sourcing
[[ -n "${RAG_COMMANDS_LOADED:-}" ]] && return 0
RAG_COMMANDS_LOADED=1

# =============================================================================
# COMMAND REGISTRY
# =============================================================================
# Format: CMD:SUBCMDS:OPTIONS:HINT
# - CMD: command name
# - SUBCMDS: comma-separated subcommands (empty if none)
# - OPTIONS: comma-separated options (empty if none)
# - HINT: short description

declare -a RAG_COMMAND_REGISTRY=(
    # Quick mode
    "quick::--agent,--save:Quick Q&A without creating a flow"
    "q::--agent,--save:Alias for quick"

    # Bundle/Compare
    "bundle::--output,-o,--exclude,-x:Bundle files into MULTICAT format"
    "compare::--output,-o,--context,-c:Compare files for LLM review"
    "diff::--output,-o,--context,-c:Alias for compare"

    # Session management
    "session:create,start,status,resume,switch,list::Manage workflow sessions"

    # Flow management
    "flow:create,start,status,resume,list,complete,promote::Manage RAG flows"

    # Evidence management
    "evidence:add,list,toggle,remove,rebase,status::Manage evidence files"

    # Context assembly
    "select:::Select evidence using ULM query"
    "assemble:::Assemble context to prompt.mdctx"
    "plan:::Show assembly plan"
    "submit:@qa,@local::Submit context to agent"

    # MULTICAT tools
    "mc::--output,-o,--exclude,-x,--example,--recursive,-r:Create MULTICAT from files"
    "ms::-y,-Y,--yes,--force:Split MULTICAT to files"
    "mi:::Show MULTICAT info"

    # Interactive
    "repl:::Start RAG REPL"
    "r:::Alias for repl"

    # MagicFind integration
    "mf:find,list,show,replay,similar::LLM-assisted file search"
    "find:::Natural language file search (alias for mf find)"

    # Utility
    "example:::Show MULTICAT example"
    "ex:::Alias for example"
    "status:::Show RAG system status"
    "s:::Alias for status"
    "init:::Initialize RAG system"
    "help:::Show help"
    "h:::Alias for help"
)

# Subcommand details: PARENT:SUB:OPTIONS:HINT
declare -a RAG_SUBCOMMAND_REGISTRY=(
    # Session subcommands
    "session:create::Create new session workspace"
    "session:start::Alias for create"
    "session:status::Show current session"
    "session:resume::Resume session by ID or index"
    "session:switch::Alias for resume"
    "session:list::List all sessions"

    # Flow subcommands
    "flow:create::Create new RAG flow"
    "flow:start::Alias for create"
    "flow:status::Show current flow status"
    "flow:resume::Resume flow by ID or index"
    "flow:list:--global:List all flows"
    "flow:complete:--outcome,-o,--lesson,-l,--artifact,-a,--tag,-t,--effort,-e:Mark flow complete"
    "flow:promote::Promote flow to global"

    # Evidence subcommands
    "evidence:add::Add file as evidence"
    "evidence:list::List evidence files"
    "evidence:toggle:on,off:Toggle evidence active/skipped"
    "evidence:remove::Remove evidence file"
    "evidence:rebase::Renumber evidence files"
    "evidence:status::Show context status and budget"

    # MagicFind subcommands
    "mf:find:-n,--dry-run,-v,--verbose,--add:Natural language search, optionally add results as evidence"
    "mf:list::List recent mf queries"
    "mf:show::Show details of a query by timestamp"
    "mf:replay::Re-execute a previous query"
    "mf:similar::Find similar past queries"
)

# Option value completions: OPTION:VALUES
declare -a RAG_OPTION_VALUES=(
    "--outcome:success,partial,abandoned,failed"
    "-o:success,partial,abandoned,failed"
    "--agent:base,openai,claude-code"
)

# =============================================================================
# REPL SLASH COMMANDS
# =============================================================================
# Format: /CMD:SUBCMDS:HINT:CATEGORY

declare -a RAG_REPL_COMMANDS=(
    # Flow
    "flow:create,status,list,resume,promote:Create and manage RAG flows:Flow"
    "f:create,status,list,resume,promote:Alias for /flow:Flow"

    # Evidence
    "evidence:add,list,toggle,status:Add/manage evidence files:Evidence"
    "e:add,list,toggle,status:Alias for /evidence:Evidence"

    # Assembly (context-aware - shown when has_evidence)
    "select::Select evidence using query:Assembly"
    "assemble::Build context from evidence:Assembly"
    "submit::Submit to QA agent:Assembly"
    "r::View LLM response:Assembly"

    # Prompt
    "p::Edit or replace flow prompt:Prompt"

    # Guide
    "workflow::Show step-by-step guide:Guide"

    # QA/KB
    "qa:search,list,view,add:Search QA history:QA"
    "kb:list,search:Manage knowledge base:KB"
    "tag::Promote flow to KB with tags:KB"

    # Info
    "status::Show RAG status:Info"

    # Melvin
    "mc::Modal context:Melvin"
    "ms::Modal send:Melvin"
    "mi::Modal info:Melvin"

    # Mode
    "cli::Enter CLI mode:Mode"

    # MagicFind
    "mf:find,list,show,replay,similar:LLM-assisted file search:Search"
    "find::Natural language search (add results as evidence):Search"

    # Help
    "help::Show help tree:Help"
    "h::Alias for /help:Help"
)

# =============================================================================
# ACCESSOR FUNCTIONS
# =============================================================================

# Get all top-level commands as space-separated string
rag_get_commands() {
    local cmds=""
    for entry in "${RAG_COMMAND_REGISTRY[@]}"; do
        local cmd="${entry%%:*}"
        cmds+="$cmd "
    done
    echo "$cmds"
}

# Get subcommands for a command
rag_get_subcommands() {
    local parent="$1"
    for entry in "${RAG_COMMAND_REGISTRY[@]}"; do
        local cmd="${entry%%:*}"
        if [[ "$cmd" == "$parent" ]]; then
            local rest="${entry#*:}"
            local subcmds="${rest%%:*}"
            echo "${subcmds//,/ }"
            return 0
        fi
    done
}

# Get options for a command
rag_get_options() {
    local parent="$1"
    local sub="${2:-}"

    # Check subcommand first
    if [[ -n "$sub" ]]; then
        for entry in "${RAG_SUBCOMMAND_REGISTRY[@]}"; do
            IFS=':' read -r p s opts hint <<< "$entry"
            if [[ "$p" == "$parent" && "$s" == "$sub" ]]; then
                echo "${opts//,/ }"
                return 0
            fi
        done
    fi

    # Fall back to parent command
    for entry in "${RAG_COMMAND_REGISTRY[@]}"; do
        local cmd="${entry%%:*}"
        if [[ "$cmd" == "$parent" ]]; then
            local rest="${entry#*:}"
            rest="${rest#*:}"  # Skip subcmds
            local opts="${rest%%:*}"
            echo "${opts//,/ }"
            return 0
        fi
    done
}

# Get hint for a command or subcommand
rag_get_hint() {
    local parent="$1"
    local sub="${2:-}"

    if [[ -n "$sub" ]]; then
        for entry in "${RAG_SUBCOMMAND_REGISTRY[@]}"; do
            IFS=':' read -r p s opts hint <<< "$entry"
            if [[ "$p" == "$parent" && "$s" == "$sub" ]]; then
                echo "$hint"
                return 0
            fi
        done
    fi

    for entry in "${RAG_COMMAND_REGISTRY[@]}"; do
        local cmd="${entry%%:*}"
        if [[ "$cmd" == "$parent" ]]; then
            local hint="${entry##*:}"
            echo "$hint"
            return 0
        fi
    done
}

# Get values for an option
rag_get_option_values() {
    local opt="$1"
    for entry in "${RAG_OPTION_VALUES[@]}"; do
        local o="${entry%%:*}"
        if [[ "$o" == "$opt" ]]; then
            local vals="${entry#*:}"
            echo "${vals//,/ }"
            return 0
        fi
    done
}

# Get REPL commands as space-separated string
rag_get_repl_commands() {
    local cmds=""
    for entry in "${RAG_REPL_COMMANDS[@]}"; do
        local cmd="${entry%%:*}"
        cmds+="$cmd "
    done
    echo "$cmds"
}

# Get REPL subcommands for a slash command
rag_get_repl_subcommands() {
    local parent="$1"
    for entry in "${RAG_REPL_COMMANDS[@]}"; do
        local cmd="${entry%%:*}"
        if [[ "$cmd" == "$parent" ]]; then
            local rest="${entry#*:}"
            local subcmds="${rest%%:*}"
            echo "${subcmds//,/ }"
            return 0
        fi
    done
}

# Get REPL hint and category
rag_get_repl_hint() {
    local parent="$1"
    for entry in "${RAG_REPL_COMMANDS[@]}"; do
        local cmd="${entry%%:*}"
        if [[ "$cmd" == "$parent" ]]; then
            local rest="${entry#*:}"
            rest="${rest#*:}"  # Skip subcmds
            local hint="${rest%%:*}"
            echo "$hint"
            return 0
        fi
    done
}

rag_get_repl_category() {
    local parent="$1"
    for entry in "${RAG_REPL_COMMANDS[@]}"; do
        local cmd="${entry%%:*}"
        if [[ "$cmd" == "$parent" ]]; then
            local cat="${entry##*:}"
            echo "$cat"
            return 0
        fi
    done
}

# =============================================================================
# EXPORTS
# =============================================================================

export RAG_COMMANDS_LOADED
export -f rag_get_commands
export -f rag_get_subcommands
export -f rag_get_options
export -f rag_get_hint
export -f rag_get_option_values
export -f rag_get_repl_commands
export -f rag_get_repl_subcommands
export -f rag_get_repl_hint
export -f rag_get_repl_category
