#!/usr/bin/env bash
# qa_complete.sh - Tab completion for qa command (v3)
#
# Provides completion for:
#   - qa subcommands
#   - qa entry IDs (for view/delete)
#   - config subcommands
#   - channel names (numbered and named)
#   - view names
#   - viewer options (for browse)
#   - :channel syntax for qq (write destination)

# =============================================================================
# COMPLETION DATA
# =============================================================================

# All qa subcommands (match qa.sh case statement)
_QA_COMMANDS="query status help config last search browse channels channel export promote merge move clear view views doctor summary gc test repl init"

# Config subcommands
_QA_CONFIG_COMMANDS="show engine apikey context"

# Channel subcommands
_QA_CHANNEL_COMMANDS="create delete rename list"

# View subcommands (v2 - added config)
_QA_VIEW_COMMANDS="create add remove delete list show config export"

# Browse viewers
_QA_VIEWERS="chroma raw"

# Working channel numbers
_QA_WORKING_CHANNELS="1 2 3 4"

# Export formats
_QA_EXPORT_FORMATS="jsonl md txt"

# Engine options for completion
_QA_ENGINES="gpt-4 gpt-4-turbo gpt-4o gpt-3.5-turbo claude-3-opus claude-3-sonnet"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List recent QA IDs (for view/delete completion)
_qa_complete_ids() {
    local db_dir="${QA_DB_DIR:-$TETRA_DIR/qa/db}"
    [[ -d "$db_dir" ]] || return

    # Return 20 most recent IDs for completion
    ls -t "$db_dir"/*.prompt 2>/dev/null | head -20 | while read -r f; do
        basename "$f" .prompt
    done
}

# List all QA IDs (for exhaustive completion)
_qa_complete_all_ids() {
    local db_dir="${QA_DB_DIR:-$TETRA_DIR/qa/db}"
    [[ -d "$db_dir" ]] || return

    for f in "$db_dir"/*.prompt; do
        [[ -f "$f" ]] && basename "$f" .prompt
    done
}

# List named channels (v2 - scan channels directory)
_qa_complete_named_channels() {
    local channels_dir="${QA_DIR:-$TETRA_DIR/qa}/channels"
    [[ -d "$channels_dir" ]] || return

    for dir in "$channels_dir"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        # Skip archive and numbered channels
        [[ "$name" == "archive" ]] && continue
        [[ "$name" =~ ^[0-9]+$ ]] && continue
        echo "$name"
    done
}

# List all channels (numbered + named)
_qa_complete_all_channels() {
    local channels_dir="${QA_DIR:-$TETRA_DIR/qa}/channels"

    # Numbered channels (always show 1-4 as options)
    echo "1"
    echo "2"
    echo "3"
    echo "4"

    # Named channels from directory
    _qa_complete_named_channels
}

# List view names
_qa_complete_views() {
    local views_dir="${QA_DIR:-$TETRA_DIR/qa}/views"
    [[ -d "$views_dir" ]] || return

    for dir in "$views_dir"/*/; do
        [[ -d "$dir" ]] && basename "$dir"
    done
}

# List IDs in a specific channel (v2 - flat structure)
_qa_complete_channel_ids() {
    local channel="$1"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local channel_dir

    case "$channel" in
        db|main|"")
            channel_dir="$base/db"
            ;;
        [0-9]*)
            channel_dir="$base/channels/$channel"
            ;;
        *)
            channel_dir="$base/channels/$channel"
            ;;
    esac

    [[ -d "$channel_dir" ]] || return

    ls -t "$channel_dir"/*.answer 2>/dev/null | head -10 | while read -r f; do
        basename "$f" .answer
    done
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_qa_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_QA_COMMANDS" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            # Commands that take QA ID
            delete|rm)
                COMPREPLY=($(compgen -W "$(_qa_complete_ids)" -- "$cur"))
                return
                ;;

            # Browse takes viewer option
            browse|b)
                COMPREPLY=($(compgen -W "$_QA_VIEWERS" -- "$cur"))
                return
                ;;

            # Config takes subcommand
            config|cfg)
                COMPREPLY=($(compgen -W "$_QA_CONFIG_COMMANDS" -- "$cur"))
                return
                ;;

            # Channel takes subcommand
            channel)
                COMPREPLY=($(compgen -W "$_QA_CHANNEL_COMMANDS" -- "$cur"))
                return
                ;;

            # View takes subcommand
            view|views)
                COMPREPLY=($(compgen -W "$_QA_VIEW_COMMANDS" -- "$cur"))
                return
                ;;

            # Export takes channel name or --all
            export)
                COMPREPLY=($(compgen -W "db --all $(_qa_complete_all_channels)" -- "$cur"))
                return
                ;;

            # Promote takes source channel (working channels)
            promote)
                COMPREPLY=($(compgen -W "$_QA_WORKING_CHANNELS" -- "$cur"))
                return
                ;;

            # Merge takes channel to merge into db
            merge)
                COMPREPLY=($(compgen -W "$(_qa_complete_all_channels)" -- "$cur"))
                return
                ;;

            # Move takes source channel (any)
            move|mv)
                COMPREPLY=($(compgen -W "$(_qa_complete_all_channels)" -- "$cur"))
                return
                ;;

            # Clear takes working channel or flags
            clear)
                COMPREPLY=($(compgen -W "$_QA_WORKING_CHANNELS --scratch --all" -- "$cur"))
                return
                ;;

            # GC options
            gc)
                COMPREPLY=($(compgen -W "--dry-run --aggressive" -- "$cur"))
                return
                ;;

            # Summary takes optional target
            summary|stats)
                COMPREPLY=($(compgen -W "all main $(_qa_complete_named_channels)" -- "$cur"))
                return
                ;;

            # List/last take optional number (no completion needed)
            list|ls|l|last|a)
                return
                ;;

            # Search/query take free text (no completion)
            search|find|f|query|q|ask)
                return
                ;;
        esac
    fi

    # Third argument - context dependent
    if [[ $COMP_CWORD -eq 3 ]]; then
        case "$cmd" in
            # Export: second arg is format
            export)
                COMPREPLY=($(compgen -W "$_QA_EXPORT_FORMATS" -- "$cur"))
                return
                ;;

            # Config subcommand values
            config|cfg)
                case "$prev" in
                    engine)
                        COMPREPLY=($(compgen -W "$_QA_ENGINES" -- "$cur"))
                        return
                        ;;
                    apikey|key|context)
                        # No completion for secrets/text
                        return
                        ;;
                esac
                ;;

            # Channel subcommand takes @name
            channel)
                case "$prev" in
                    create)
                        # User types new name, no completion
                        return
                        ;;
                    delete|rm|rename|mv)
                        COMPREPLY=($(compgen -W "$(_qa_complete_named_channels)" -- "$cur"))
                        return
                        ;;
                esac
                ;;

            # View subcommand args
            view|views)
                case "$prev" in
                    create)
                        # User types new name, no completion
                        return
                        ;;
                    add|remove|rm|delete|del|show|export)
                        COMPREPLY=($(compgen -W "$(_qa_complete_views)" -- "$cur"))
                        return
                        ;;
                esac
                ;;

            # Promote: second arg is ID or destination
            promote)
                COMPREPLY=($(compgen -W "$(_qa_complete_named_channels) main" -- "$cur"))
                return
                ;;

            # Move: second arg is ID or destination
            move|mv)
                COMPREPLY=($(compgen -W "$(_qa_complete_all_channels)" -- "$cur"))
                return
                ;;
        esac
    fi

    # Fourth argument
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "$cmd" in
            # Channel rename: fourth arg is new name
            channel)
                # User types new name, no completion
                return
                ;;

            # View add: IDs to add
            view|views)
                local subcmd="${COMP_WORDS[2]}"
                case "$subcmd" in
                    add)
                        COMPREPLY=($(compgen -W "$(_qa_complete_ids) --from --last" -- "$cur"))
                        return
                        ;;
                    export)
                        COMPREPLY=($(compgen -W "jsonl md txt" -- "$cur"))
                        return
                        ;;
                esac
                ;;

            # Promote: destination
            promote)
                COMPREPLY=($(compgen -W "$(_qa_complete_named_channels) main" -- "$cur"))
                return
                ;;

            # Move: destination
            move|mv)
                COMPREPLY=($(compgen -W "$(_qa_complete_all_channels)" -- "$cur"))
                return
                ;;
        esac
    fi

    # Fifth+ argument for view add (multiple IDs)
    if [[ $COMP_CWORD -ge 5 && ("$cmd" == "view" || "$cmd" == "views") ]]; then
        local subcmd="${COMP_WORDS[2]}"
        if [[ "$subcmd" == "add" ]]; then
            # Handle --from channel completion
            if [[ "$prev" == "--from" ]]; then
                COMPREPLY=($(compgen -W "$(_qa_complete_all_channels) main" -- "$cur"))
                return
            fi
            # Handle --last number
            if [[ "$prev" == "--last" ]]; then
                COMPREPLY=($(compgen -W "5 10 20 50" -- "$cur"))
                return
            fi
            # More IDs
            COMPREPLY=($(compgen -W "$(_qa_complete_ids) --from --last" -- "$cur"))
            return
        fi
    fi
}

# =============================================================================
# SHORTCUT COMPLETIONS
# =============================================================================

# qq completion - :channel syntax for write destination
# Usage: qq :channel question  (write to channel)
#        qq question           (write to db)
_qq_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=()

    # First arg: :channel syntax for destination
    if [[ $COMP_CWORD -eq 1 ]]; then
        if [[ "$cur" == :* ]]; then
            # Complete channel name after :
            local prefix="${cur#:}"
            local channels="db $(_qa_complete_all_channels)"
            COMPREPLY=($(compgen -P ":" -W "$channels" -- "$prefix"))
        else
            # Suggest :channel hints
            COMPREPLY=($(compgen -W ":db :1 :2 :3 :4" -- "$cur"))
        fi
    fi
    # No completion for question text
}

# qq1-4 completion - no special syntax, just ask questions
# These numbered shortcuts directly write to their channel
_qq_numbered_complete() {
    # No completion needed - user just types their question
    COMPREPLY=()
}

# a/q completion - channel or index for viewing
# Usage: a [channel] [index]  or  q [channel] [index]
# Examples: a, a 5, a git, a git 5
_qa_view_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    COMPREPLY=()

    if [[ $COMP_CWORD -eq 1 ]]; then
        # First arg: index or channel name
        COMPREPLY=($(compgen -W "0 1 2 3 4 5 db $(_qa_complete_all_channels)" -- "$cur"))
    elif [[ $COMP_CWORD -eq 2 ]]; then
        # Second arg: index (if first was a channel)
        if [[ ! "$prev" =~ ^[0-9]+$ ]]; then
            COMPREPLY=($(compgen -W "0 1 2 3 4 5" -- "$cur"))
        fi
    fi
}

# =============================================================================
# REGISTER COMPLETIONS
# =============================================================================

complete -F _qa_complete qa
complete -F _qq_complete qq
complete -F _qq_numbered_complete qq1 qq2 qq3 qq4 qqq
complete -F _qa_view_complete a a1 a2 a3 a4 q q1 q2 q3 q4

# Functions available via source - no export -f needed
