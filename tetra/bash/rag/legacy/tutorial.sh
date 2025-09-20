#!/usr/bin/env bash
# tutorial.sh - Interactive MULTICAT Tutorial with AST-aware Function Merging

set -euo pipefail

# Source tools.sh to load bash functions without killing the app
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/tools.sh" ]]; then
    source "$SCRIPT_DIR/tools.sh"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Tutorial configuration
TUTORIAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAG_DIR="$TUTORIAL_DIR/tutorial-rag"

# Initialize tutorial environment
init_tutorial() {
  echo -e "${CYAN}=== MULTICAT + AST Tutorial ===${NC}"
  echo "Initializing tutorial environment..."
  
  # Create RAG_DIR structure
  mkdir -p "$RAG_DIR"/{sessions,functions,conflicts}
  
  echo -e "${GREEN}Tutorial environment ready!${NC}"
  echo
}

# Wait for user input
wait_for_user() {
  echo -e "${YELLOW}Press Enter to continue...${NC}"
  read -r
}

# Run command and show output
demo_command() {
  local description="$1"
  shift
  
  echo -e "${BLUE}>>> $description${NC}"
  echo -e "${CYAN}$ $*${NC}"
  
  if "$@"; then
    echo -e "${GREEN}✓ Command completed successfully${NC}"
  else
    echo -e "${RED}✗ Command failed${NC}"
    return 1
  fi
  echo
}

# Phase 1: Demonstrate the broken MPM
phase1_broken_demo() {
  echo -e "${CYAN}=== Phase 1: Broken MPM Demonstration ===${NC}"
  echo "Let's see how the broken mini process manager fails:"
  echo
  
  demo_command "Try to start a process with broken mpm" \
    ./mpm-broken.sh start testserver "python3 -m http.server 8080" || true
  
  demo_command "Try to list processes (will fail)" \
    ./mpm-broken.sh list || true
  
  echo -e "${RED}Problems identified:${NC}"
  echo "1. MPM_DIR is not properly initialized"
  echo "2. PID and log files go to wrong directory"
  echo "3. Process listing logic is broken"
  echo "4. Process stopping uses wrong signal handling"
  echo
  
  wait_for_user
}

# Phase 2: Capture with multicat
phase2_capture() {
  echo -e "${CYAN}=== Phase 2: Capture Source with MULTICAT ===${NC}"
  echo "Let's capture the broken source code into MULTICAT format:"
  echo
  
  demo_command "Create MULTICAT from broken source" \
    ./bash/multicat.sh mpm-broken.sh > broken-capture.mc
  
  demo_command "Inspect the captured content" \
    ./bash/mcinfo.sh broken-capture.mc
  
  echo -e "${GREEN}Source captured successfully!${NC}"
  echo
  
  wait_for_user
}

# Phase 3A: Traditional diff workflow
phase3a_diff_workflow() {
  echo -e "${CYAN}=== Phase 3A: Traditional Diff Workflow ===${NC}"
  echo "First, let's try the traditional diff-based approach:"
  echo
  
  echo -e "${YELLOW}Simulating LLM response with unified diffs...${NC}"
  
  demo_command "Apply traditional diffs using multidiff" \
    ./bash/multidiff.sh < llm-response-diff.mc > fixed-diff.mc
  
  demo_command "Extract the fixed files" \
    ./bash/multisplit.sh -y fixed-diff.mc
  
  echo -e "${GREEN}Traditional diff approach completed!${NC}"
  echo "Note: This works but diffs can be fragile and hard to read."
  echo
  
  wait_for_user
}

# Phase 3B: Function cursor workflow  
phase3b_function_workflow() {
  echo -e "${CYAN}=== Phase 3B: Function Cursor Workflow ===${NC}"
  echo "Now let's try the new AST-aware function replacement:"
  echo
  
  # First restore the broken version
  demo_command "Restore broken version for function demo" \
    cp mpm-broken.sh mpm-broken-copy.sh
  
  echo -e "${YELLOW}Simulating LLM response with function cursors...${NC}"
  
  demo_command "Apply function replacements using multimerge with RAG tracking" \
    ./bash/multimerge.sh --rag-dir "$RAG_DIR" llm-response-functions.mc > fixed-functions.mc
  
  demo_command "Extract the fixed files" \
    ./bash/multisplit.sh -y fixed-functions.mc
  
  echo -e "${GREEN}Function cursor approach completed!${NC}"
  echo "Benefits:"
  echo "- Clean function-level replacements"
  echo "- AST-aware syntax checking"
  echo "- Session tracking with timestamps"
  echo "- Surgical changes without diff fragility"
  echo
  
  wait_for_user
}

# Phase 4: Test the working MPM
phase4_test_working() {
  echo -e "${CYAN}=== Phase 4: Test the Working MPM ===${NC}"
  echo "Let's test our fixed mini process manager:"
  echo
  
  # Set MPM_DIR for testing
  export MPM_DIR="./test-processes"
  
  demo_command "Start a test web server" \
    ./mpm-broken.sh start webserver "python3 -m http.server 8080"
  
  demo_command "List running processes" \
    ./mpm-broken.sh list
  
  demo_command "Check server logs" \
    ./mpm-broken.sh logs webserver 10 || echo "Server just started, no logs yet"
  
  demo_command "Stop the web server" \
    ./mpm-broken.sh stop webserver
  
  demo_command "Verify process stopped" \
    ./mpm-broken.sh list
  
  echo -e "${GREEN}MPM is now working correctly!${NC}"
  echo
  
  wait_for_user
}

# Phase 5: Show session tracking
phase5_session_tracking() {
  echo -e "${CYAN}=== Phase 5: Session Tracking and Analysis ===${NC}"
  echo "Let's examine the session data that was tracked:"
  echo
  
  local latest_session
  latest_session=$(find "$RAG_DIR/sessions" -type d -name "[0-9]*" | sort -n | tail -1)
  
  if [[ -n "$latest_session" && -d "$latest_session" ]]; then
    echo -e "${YELLOW}Latest session: $(basename "$latest_session")${NC}"
    
    demo_command "Show session summary" \
      cat "$latest_session/summary.txt" || echo "No summary available"
    
    demo_command "Show operations log" \
      cat "$latest_session/operations.log" || echo "No operations log"
    
    demo_command "List session files" \
      ls -la "$latest_session/"
    
    echo -e "${GREEN}Session tracking provides full audit trail!${NC}"
  else
    echo -e "${YELLOW}No session data found${NC}"
  fi
  echo
  
  wait_for_user
}

# Phase 6: Compare approaches
phase6_comparison() {
  echo -e "${CYAN}=== Phase 6: Approach Comparison ===${NC}"
  echo
  
  echo -e "${YELLOW}Traditional Diff Approach:${NC}"
  echo "✓ Works with existing tooling"
  echo "✓ Handles complex multi-line changes"
  echo "✗ Fragile to whitespace and context changes"
  echo "✗ Hard to read and understand intent"
  echo "✗ Can break with code reformatting"
  echo
  
  echo -e "${YELLOW}Function Cursor Approach:${NC}"
  echo "✓ Clean, readable function replacements"
  echo "✓ AST-aware syntax validation"
  echo "✓ Language-specific intelligence"
  echo "✓ Robust against formatting changes"
  echo "✓ Session tracking and audit trails"
  echo "✗ Limited to function-level changes"
  echo "✗ Requires language-specific AST support"
  echo
  
  echo -e "${YELLOW}Hybrid Approach (Best):${NC}"
  echo "✓ Function cursors for clean replacements"
  echo "✓ Traditional diffs for complex changes"
  echo "✓ Backward compatibility"
  echo "✓ Session tracking throughout"
  echo
  
  wait_for_user
}

# Cleanup
cleanup_tutorial() {
  echo -e "${CYAN}=== Tutorial Cleanup ===${NC}"
  echo "Cleaning up tutorial files..."
  
  # Remove generated files but keep the examples
  rm -f broken-capture.mc fixed-diff.mc fixed-functions.mc mpm-broken-copy.sh
  rm -rf test-processes/
  
  echo -e "${GREEN}Tutorial completed!${NC}"
  echo
  echo "Files created during this tutorial:"
  echo "- AST modules: bash/ast.sh, bash/ast_bash.sh, bash/ast_go.sh"
  echo "- Enhanced merge tool: bash/multimerge.sh"
  echo "- Example files: mpm-broken.sh, llm-response-*.mc"
  echo "- Session data: $RAG_DIR/"
  echo
  echo "You now have a complete MULTICAT toolchain with:"
  echo "1. Traditional diff support (multidiff.sh)"
  echo "2. AST-aware function cursors (multimerge.sh)"
  echo "3. Session tracking with timestamps"
  echo "4. Language-extensible architecture"
  echo
  echo -e "${CYAN}Happy coding!${NC}"
}

# Main tutorial execution
main() {
  cd "$TUTORIAL_DIR"
  
  init_tutorial
  phase1_broken_demo
  phase2_capture
  phase3a_diff_workflow
  phase3b_function_workflow
  phase4_test_working
  phase5_session_tracking
  phase6_comparison
  cleanup_tutorial
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Tutorial interrupted. Run with cleanup if needed.${NC}"; exit 1' INT

# Function to start the tutorial manually
rag_tutorial() {
    local TUTORIAL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    # Change to tutorial directory
    cd "$TUTORIAL_DIR"
    
    # Run the tutorial steps
    init_tutorial
    phase1_broken_demo
    phase2_capture
    phase3a_diff_workflow
    phase3b_function_workflow
    phase4_test_working
    phase5_session_tracking
    phase6_comparison
    cleanup_tutorial
    
    # Return to original directory
    cd - > /dev/null
}