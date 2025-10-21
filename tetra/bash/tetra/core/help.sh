#!/usr/bin/env bash
# Tetra Hierarchical Help System

# Main help - shows topics
tetra_help_main() {
    cat <<'EOF'
tetra - Tetra Orchestrator

USAGE:
    tetra <command> [args]        Execute command directly
    tetra repl [--rlwrap]         Interactive REPL mode
    tetra tui                     Visual TUI mode
    tetra help [topic]            Show help (see topics below)
    tetra version                 Show version

HELP TOPICS:
    commands     Direct command mode and meta-actions
    repl         Interactive REPL mode features
    tui          Visual TUI interface
    agents       Agent management system
    modules      Module system and actions
    composition  Piping and action composition
    context      Organization, environment, and mode

Use 'tetra help <topic>' for detailed information.

QUICK START:
    tetra list modules            # See what's loaded
    tetra list actions            # See available actions
    tetra repl                    # Start interactive mode
    tetra help repl               # Learn REPL features

For complete documentation, see docs/TETRA_ORCHESTRATOR.md
EOF
}

# Commands topic
tetra_help_commands() {
    cat <<'EOF'
COMMANDS - Direct Command Mode

USAGE:
    tetra <action> [args]         Execute action and exit

ORCHESTRATOR META-ACTIONS:
    show status                   Display orchestrator status
    list modules                  List loaded modules
    list actions                  List discovered actions
    agent <cmd> [args]            Agent management (see: tetra help agents)
    help [topic]                  Show help

MODULE ACTIONS:
    <module> <action> [args]      Execute module action

    Examples:
        tetra rag list agents     # RAG module action
        tetra flow create "task"  # Flow module action
        tetra rag select "*.sh"   # RAG selection

GETTING STARTED:
    tetra list modules            # See available modules
    tetra list actions            # See all actions
    tetra help modules            # Learn about modules
    tetra help composition        # Learn about piping

See also: tetra help repl, tetra help modules
EOF
}

# REPL topic
tetra_help_repl() {
    cat <<'EOF'
REPL - Interactive REPL Mode

USAGE:
    tetra repl                    Basic mode with readline
    tetra repl --rlwrap           Enhanced mode with full history

FEATURES:
    - Persistent context (org, env, mode)
    - Command history with arrow keys
    - Readline editing (Ctrl-A/E, Ctrl-U/W)
    - Slash commands for REPL control
    - Direct action dispatch (no / prefix)

SLASH COMMANDS:
    /help, /h                     Show REPL help
    /exit, /quit, /q              Exit REPL

    Context Management:
      /org [name]                 Get/set organization
      /env [name]                 Get/set environment
      /mode [modules]             Get/set mode filter
      /context                    Show context summary

    System:
      /status                     Orchestrator status
      /history                    Recent commands
      /clear                      Clear screen

ACTIONS (no / prefix):
    list modules                  List loaded modules
    list actions                  List available actions
    <module> <action> [args]      Execute module action

EXAMPLES:
    tetra repl
    > /org mycompany
    > /env Production
    > /mode rag,flow
    > rag list agents
    > flow create "new task"
    > /exit

ENHANCED MODE:
    For better history and editing:
      tetra repl --rlwrap
    Or install rlwrap:
      brew install rlwrap         # macOS
      apt install rlwrap          # Linux

See also: tetra help context, tetra help commands
EOF
}

# TUI topic
tetra_help_tui() {
    cat <<'EOF'
TUI - Visual TUI Mode

USAGE:
    tetra tui                     Launch visual interface

FEATURES:
    - Panel-based navigation
    - Visual action execution
    - Context-aware displays
    - Keyboard-driven workflow

STATUS:
    TUI mode is under development. The interface provides
    a visual alternative to REPL mode for interactive use.

REQUIREMENTS:
    TUI interface requires additional components.
    See docs/TETRA_TUI.md for installation.

ALTERNATIVES:
    For interactive use, try:
      tetra repl                  # Line-based REPL
      tetra repl --rlwrap         # Enhanced REPL

See also: tetra help repl
EOF
}

# Agents topic
tetra_help_agents() {
    cat <<'EOF'
AGENTS - Agent Management System

USAGE:
    tetra agent <command> [args]

AGENT COMMANDS:
    list                          List all registered agents
    info <name>                   Show agent information
    status <name>                 Check agent connection status
    profiles <name>               List available agent profiles

    Lifecycle:
      init <name>                 Initialize agent
      connect <name>              Connect to agent
      disconnect <name>           Disconnect from agent
      cleanup <name>              Cleanup agent resources

EXAMPLES:
    tetra agent list              # See available agents
    tetra agent info cdp          # CDP agent details
    tetra agent status cdp        # Check CDP connection
    tetra agent init cdp          # Initialize CDP
    tetra agent connect cdp       # Connect to CDP

AGENT TYPES:
    Agents provide external integrations for modules.
    Common agents:
      - cdp: Chrome DevTools Protocol
      - qa: Question/Answer agent
      - Custom module agents

CONFIGURATION:
    Agents are defined in module agent configs:
      $TETRA_SRC/bash/<module>/agents/<agent>.conf

See also: tetra help modules
EOF
}

# Modules topic
tetra_help_modules() {
    cat <<'EOF'
MODULES - Module System and Actions

MODULES:
    Modules are loaded from $TETRA_SRC/bash/<module>/
    Each module provides actions via:
      bash/<module>/actions.sh    # Action definitions

VIEWING MODULES:
    tetra list modules            # List loaded modules
    tetra list actions            # List all actions
    tetra list actions <module>   # Module-specific actions

ACTION DISPATCH:
    tetra <module> <action> [args]

    Examples:
      tetra rag select "*.sh"     # RAG module
      tetra flow create "task"    # Flow module

MODULE STRUCTURE:
    bash/<module>/
      actions.sh                  # Action definitions
      agents/                     # Agent configs (optional)
      <module>.sh                 # Implementation

CREATING MODULES:
    See docs/Tetra_Module_Convention.md

COMMON MODULES:
    rag       Retrieval-Augmented Generation
    flow      Flow/task management
    qa        Question/Answer system

See also: tetra help commands, tetra help composition
EOF
}

# Composition topic
tetra_help_composition() {
    cat <<'EOF'
COMPOSITION - Piping and Action Composition

UNIX-STYLE COMPOSITION:
    Tetra actions can be composed using pipes:

    tetra <action1> | tetra <action2> | tetra <action3>

EXAMPLES:
    # Select files and add to flow
    tetra rag select "*.sh" | tetra flow add-input -

    # Chain processing
    tetra rag search "pattern" | tetra qa analyze -

STDIN HANDLING:
    Actions that accept piped input use '-' as argument:
      tetra flow add-input -      # Read from stdin

OUTPUT FORMATS:
    Actions should output clean, pipeable data:
      - Line-based output for lists
      - JSON for structured data
      - Plain text for content

DESIGNING COMPOSABLE ACTIONS:
    When creating actions:
      1. Accept stdin via '-' argument
      2. Output clean, parseable data
      3. Use stderr for messages
      4. Exit codes: 0=success, 1=error

REPL COMPOSITION:
    In REPL mode, composition works the same:
      > rag select "*.sh" | flow add-input -

See also: tetra help modules, tetra help commands
EOF
}

# Context topic
tetra_help_context() {
    cat <<'EOF'
CONTEXT - Organization, Environment, and Mode

CONTEXT DIMENSIONS:
    Org       Organization/company context
    Env       Environment (Local, Dev, Staging, Production)
    Mode      Module filter (comma-separated)

VIEWING CONTEXT:
    tetra show status             # Includes context

    In REPL:
      /context                    # Full context summary
      /org                        # Current org
      /env                        # Current env
      /mode                       # Current mode

SETTING CONTEXT:
    Context is primarily managed in REPL mode:

    In REPL:
      /org mycompany              # Set organization
      /env Production             # Set environment
      /mode rag,flow              # Filter to modules

CONTEXT EFFECTS:
    - Org/Env: Passed to actions for environment-aware behavior
    - Mode: Filters available actions to specified modules
    - Prompt: Shows current context [Org × Env × Mode]

CONTEXT SUMMARY:
    Use '/context' in REPL to see:
      - Current Org × Env × Mode
      - Available actions in current mode
      - Action mapping by module

EXAMPLES:
    tetra repl
    > /org acme
    > /env Production
    > /mode rag
    > /context                    # See filtered actions
    > rag select "*.sh"           # Execute in context

See also: tetra help repl
EOF
}

# Main help dispatcher
tetra_show_help() {
    local topic="${1:-}"

    case "$topic" in
        "")
            tetra_help_main
            ;;
        commands|cmd|command)
            tetra_help_commands
            ;;
        repl|interactive)
            tetra_help_repl
            ;;
        tui|visual|ui)
            tetra_help_tui
            ;;
        agents|agent)
            tetra_help_agents
            ;;
        modules|module|actions)
            tetra_help_modules
            ;;
        composition|pipe|piping)
            tetra_help_composition
            ;;
        context|org|env|mode)
            tetra_help_context
            ;;
        *)
            echo "Unknown help topic: $topic" >&2
            echo "" >&2
            echo "Available topics:" >&2
            echo "  commands, repl, tui, agents, modules, composition, context" >&2
            echo "" >&2
            echo "Use 'tetra help' for main help" >&2
            return 1
            ;;
    esac
}

# Export functions
export -f tetra_show_help
export -f tetra_help_main
export -f tetra_help_commands
export -f tetra_help_repl
export -f tetra_help_tui
export -f tetra_help_agents
export -f tetra_help_modules
export -f tetra_help_composition
export -f tetra_help_context
