#!/usr/bin/env bash
# help.sh - Help system for RAG commands

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# ============================================================================
# HELP COMMAND
# ============================================================================

rag_cmd_help() {
    local topic="$1"

    # If topic requested, show topic help
    if [[ -n "$topic" ]]; then
        case "$topic" in
            session|s)
                cat <<'EOF'
SESSION - Workspace Management

A session is a workspace containing related flows.
Flows are automatically added to the current session.

Commands:
  /session create <desc>     Create new session
  /session status            Show current session
  /session list              List all sessions
  /session resume <id>       Resume session by ID or index
  /s                         Alias for /session

Examples:
  /s create "Auth refactor"
  /s list
  /s resume 1
EOF
                ;;
            flow|f)
                cat <<'EOF'
FLOW - Mini Inquiry (10-30 min)

A flow is a focused investigation: Question → Evidence → Answer

Commands:
  /flow create <desc>        Create flow (mini inquiry)
  /flow status               Show current flow
  /flow inspect              Detailed view (tokens, artifacts)
  /flow list                 List all flows
  /flow resume <id>          Resume flow by ID or index
  /flow complete             Mark complete with outcome
  /f                         Alias for /flow

Examples:
  /f create "How does auth work?"
  /f complete --outcome success --lesson "Uses JWT"
EOF
                ;;
            evidence|e)
                cat <<'EOF'
EVIDENCE - Curated Context

Add source files to your inquiry with justification.

Commands:
  /e add <file>              Add whole file
  /e add <file>::100,200     Add lines 100-200
  /e add <file>#tag1,tag2    Add with tags
  /e list                    List all evidence
  /e <N>                     View evidence N (1,2,3...)
  /e toggle <N>              Toggle evidence on/off

Variables: $e1 $e2 $e3 ... (use in shell: cat $e1)

Examples:
  /e add src/auth.js::50,100#bug
  /e 1
EOF
                ;;
            quick|q)
                cat <<'EOF'
QUICK - No-Flow Q&A

Quick question without creating a flow.

Usage:
  /quick "<question>" <files...>
  /q "<question>" <files...>

Examples:
  /q "how does this work" src/parser.js
  /quick "explain the algorithm" lib/*.js
EOF
                ;;
            *)
                echo "Unknown help topic: $topic"
                echo "Available topics: session, flow, evidence, quick"
                echo "Try: /help (show overview)"
                return 1
                ;;
        esac
        return 0
    fi

    # Show hierarchical overview
    cat <<'EOF'
RAG - Retrieval Augmented Generation

HIERARCHY
  Session → Flow → Evidence → Answer
    └─ Workspace    └─ Mini inquiry   └─ Context    └─ Result

ESSENTIAL
  /quick "question" files...        Quick Q&A (no flow)

  /session create "workspace"       Start workspace
  /flow create "inquiry"            Start investigation
  /e add file                       Add evidence
  /assemble                         Build context
  /submit @qa                       Submit to LLM
  /a 0                              View answer

COMMANDS (use /help <cmd> for details)
  /session  /s      Workspace management
  /flow     /f      Mini inquiries (10-30 min)
  /evidence /e      Curated context
  /quick    /q      No-flow Q&A

  /assemble         Build prompt
  /submit @qa       Submit to agent
  /r                View response
  /a [n]            View answer

Examples:
  /help session     Session details
  /help flow        Flow details
  /help evidence    Evidence details

  /s list           List sessions
  /f create "?"     Start inquiry
  /e add file.js    Add evidence
  /f complete       Finish with outcome

TAB for completion. Ctrl+D to exit.
EOF
}

# Export function
export -f rag_cmd_help
