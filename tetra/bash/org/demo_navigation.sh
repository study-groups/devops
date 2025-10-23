#!/usr/bin/env bash
# Visual demo of new TAB-based navigation model

source "bash/org/org_repl_tui.sh"

# Initialize state
ORG_REPL_ENV_INDEX=0
ORG_REPL_MODE_INDEX=0
ORG_REPL_ACTION_INDEX=0
ORG_REPL_FOCUS=0
ORG_REPL_COMMAND_HISTORY=("view:toml" "list" "view:env")
ORG_REPL_HISTORY_INDEX=-1

echo "═══════════════════════════════════════════════════════════"
echo "  NEW TAB-BASED NAVIGATION MODEL - VISUAL DEMO"
echo "═══════════════════════════════════════════════════════════"
echo
echo "Press TAB to cycle focus through sections:"
echo "  Env → Mode → Action → (wrap)"
echo
echo "Arrow keys are context-aware:"
echo "  • When focused on Env/Mode: Select option with ↑/↓"
echo "  • When focused on Action: Navigate history with ↑/↓"
echo
echo "───────────────────────────────────────────────────────────"
echo

# Demo 1: Focus on Environment
ORG_REPL_FOCUS=0
echo "1. TAB focus on Environment (underlined):"
echo -n "   "
_org_build_prompt_text
echo
echo "   Press ↑/↓ to select: Local, Dev, Staging, Production"
echo

# Demo 2: Focus on Mode
ORG_REPL_FOCUS=1
echo "2. TAB focus on Mode (underlined):"
echo -n "   "
_org_build_prompt_text
echo
echo "   Press ↑/↓ to select: Inspect, Transfer, Execute"
echo

# Demo 3: Focus on Action
ORG_REPL_FOCUS=2
echo "3. TAB focus on Action (underlined):"
echo -n "   "
_org_build_prompt_text
echo
echo "   Press ↑/↓ to navigate command history"
echo "   History: ${ORG_REPL_COMMAND_HISTORY[@]}"
echo

echo "───────────────────────────────────────────────────────────"
echo
echo "LEGACY SHORTCUTS (still work):"
echo "  Ctrl+E  - Cycle environment"
echo "  Ctrl+R  - Cycle mode"
echo "  Ctrl+A  - Cycle action"
echo "  Ctrl+X  - Execute current action"
echo
echo "═══════════════════════════════════════════════════════════"
