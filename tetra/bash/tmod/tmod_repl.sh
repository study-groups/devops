#!/usr/bin/env bash

# tmod REPL - Interactive module management interface

# Load shared REPL utilities
source "${TETRA_SRC:-$HOME/src/devops/tetra}/bash/utils/repl_utils.sh"

tmod_repl() {
    local session_start=$(date)
    local command_count=0
    
    # Save current history state
    local original_histfile="$HISTFILE"
    local original_histsize="$HISTSIZE"
    
    # Set up isolated REPL history
    export HISTFILE="$TMOD_HISTORY_FILE"
    export HISTSIZE=1000
    
    # Load REPL history
    if [[ -f "$TMOD_HISTORY_FILE" ]]; then
        history -c  # Clear current history
        history -r "$TMOD_HISTORY_FILE"  # Read REPL history
    fi
    
    # REPL banner
    cat <<'EOF'
╭─────────────────────────────────────────────────────────────╮
│                    Tetra Module Manager                     │
│                         REPL Mode                           │
╰─────────────────────────────────────────────────────────────╯

Type 'help' for commands, 'exit' to quit, or use tab completion.
EOF
    
    # Show quick status
    echo
    tmod_status | head -8
    echo
    
    # REPL loop
    while true; do
        # Read command with readline support
        read -e -p "tmod> " input
        
        # Handle empty input
        [[ -z "$input" ]] && continue
        
        # Add to history
        history -s "$input"
        command_count=$((command_count + 1))
        
        # Parse command and arguments (following tkm_repl pattern)
        local cmd args
        if [[ "$input" =~ [[:space:]] ]]; then
            cmd="${input%% *}"
            args="${input#* }"
        else
            cmd="$input"
            args=""
        fi
        
        case "$cmd" in
            exit|quit|q)
                echo "Goodbye! Executed $command_count commands in this session."
                break
                ;;
            help|h)
                tmod_repl_help "${args[@]}"
                ;;
            load|l)
                tmod_load_module $args
                ;;
            unload|remove|rm)
                tmod_unload_module $args
                ;;
            list|ls)
                tmod_list_modules $args
                ;;
            find|search|f)
                tmod_find_modules $args
                ;;
            info|i)
                if [[ -n "$args" ]]; then
                    tetra_module_help $args
                else
                    echo "Usage: info <module>"
                    echo "Available modules:"
                    tetra_get_available_modules | sed 's/^/  /'
                fi
                ;;
            status|st)
                tmod_status
                ;;
            dev)
                tmod_dev $args
                ;;
            fix)
                tmod_fix $args
                ;;
            index)
                tmod_index
                ;;
            clear|cls)
                clear
                echo "tmod REPL - Type 'help' for commands"
                ;;
            history)
                tmod_repl_history
                ;;
            stats)
                tmod_repl_stats "$session_start" "$command_count"
                ;;
            "")
                # Empty command, do nothing
                ;;
            *)
                echo "Unknown command: $cmd"
                echo "Available commands: load, unload, list, find, info, status, help, exit"
                echo "Type 'help' for more information"
                ;;
        esac
    done
    
    # Save REPL history
    history -w "$TMOD_HISTORY_FILE"
    
    # Restore original history settings
    export HISTFILE="$original_histfile"
    export HISTSIZE="$original_histsize"
    
    # Restore original shell history
    if [[ -f "$original_histfile" ]]; then
        history -c  # Clear current history
        history -r "$original_histfile"  # Restore original history
    fi
}

tmod_repl_help() {
    local topic="$1"
    
    if [[ -n "$topic" ]]; then
        case "$topic" in
            commands)
                cat <<'EOF'
Available Commands:
  load <module> [-dev]    Load a module
  unload <module>         Unload a module
  list [filter] [-dev]    List modules (all, loaded, unloaded, category)
  find <pattern>          Search modules
  info <module>           Show module details
  status                  Show system status
  dev <subcmd>            Development operations
  fix [path]              Fix includes.sh files
  index                   Rebuild module index
  clear                   Clear screen
  history                 Show command history
  stats                   Show session statistics
  help [topic]            Show help (topics: commands, shortcuts, tips)
  exit                    Quit REPL
EOF
                ;;
            shortcuts)
                cat <<'EOF'
Keyboard Shortcuts:
  Tab                     Auto-complete commands and modules
  Ctrl+C                  Cancel current input
  Ctrl+D                  Exit REPL
  Up/Down arrows          Navigate command history
  Ctrl+R                  Reverse search history
  
Command Shortcuts:
  l                       load
  ls                      list
  f                       find
  i                       info
  st                      status
  h                       help
  q                       exit
EOF
                ;;
            tips)
                cat <<'EOF'
Pro Tips:
  • Use tab completion for module names and commands
  • 'list category' shows modules organized by purpose
  • 'find <pattern>' searches both names and descriptions
  • 'load <module> -dev' includes development modules
  • 'dev register' discovers new development modules
  • Command history persists between sessions
  • Use 'info <module>' to see detailed module information
  • The prompt shows loaded/total module count
EOF
                ;;
            *)
                echo "Help topics: commands, shortcuts, tips"
                echo "Or use 'help' for general command list"
                ;;
        esac
    else
        cat <<'EOF'
tmod REPL Commands:
  load <module>           Load a module
  unload <module>         Unload a module  
  list [filter]           List modules
  find <pattern>          Search modules
  info <module>           Show module details
  status                  Show system status
  help [topic]            Show help (topics: commands, shortcuts, tips)
  exit                    Quit REPL

Use tab completion and type 'help shortcuts' for keyboard shortcuts.
EOF
    fi
}

tmod_repl_history() {
    echo "Recent commands:"
    history | tail -10 | sed 's/^[ ]*[0-9]*[ ]*/  /'
}

tmod_repl_stats() {
    local session_start="$1"
    local command_count="$2"
    
    echo "Session Statistics:"
    echo "  Started: $session_start"
    echo "  Commands executed: $command_count"
    echo "  Modules loaded: $(tetra_get_loaded_modules | wc -w)"
    echo "  History file: $TMOD_HISTORY_FILE"
}

# Tab completion for REPL commands
_tmod_repl_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[0]}"
    
    case "$COMP_CWORD" in
        0)
            COMPREPLY=($(compgen -W "load unload list find info status dev fix index clear history stats help exit" -- "$cur"))
            ;;
        1)
            case "$cmd" in
                load|l)
                    COMPREPLY=($(compgen -W "$(tetra_get_unloaded_modules)" -- "$cur"))
                    ;;
                unload|remove|rm)
                    COMPREPLY=($(compgen -W "$(tetra_get_loaded_modules)" -- "$cur"))
                    ;;
                list|ls)
                    COMPREPLY=($(compgen -W "all loaded unloaded available registered category -dev" -- "$cur"))
                    ;;
                info|i)
                    COMPREPLY=($(compgen -W "$(tetra_get_available_modules)" -- "$cur"))
                    ;;
                help|h)
                    COMPREPLY=($(compgen -W "commands shortcuts tips" -- "$cur"))
                    ;;
                dev)
                    COMPREPLY=($(compgen -W "register list help" -- "$cur"))
                    ;;
            esac
            ;;
    esac
}

# Enable completion in REPL context
complete -F _tmod_repl_completion load unload list find info help dev
