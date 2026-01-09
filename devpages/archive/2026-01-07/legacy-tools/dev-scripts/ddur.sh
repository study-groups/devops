#!/bin/bash

# D2UR: Data-Driven UI Refinement Cycle v2
# A systematic shell utility for managing iterative UI development cycles
# Integrates with qa.sh (LLM queries) and melvin.sh (cost tracking)

# === CONSTANTS & CONFIGURATION ===
readonly DDUR_ROOT="dev-scripts"
readonly RUNS_DIR="$DDUR_ROOT/runs"
readonly PLAYWRIGHT_DIR="$DDUR_ROOT/playwright"
readonly INSPECTOR_DIR="$DDUR_ROOT/inspector"

# Run states for tracking loop progress
readonly STATE_INIT="INIT"
readonly STATE_BASELINE="BASELINE"
readonly STATE_AUGMENT="AUGMENT"
readonly STATE_PROMPT="PROMPT"
readonly STATE_APPLY="APPLY"
readonly STATE_VERIFY="VERIFY"
readonly STATE_SUCCESS="SUCCESS"
readonly STATE_FAIL="FAIL"

# === CORE DDUR FUNCTIONS ===

ddur_help() {
    cat << 'EOF'
D2UR (Data-Driven UI Refinement) Cycle Manager v2

Usage: source dev-scripts/ddur.sh

Core Functions:
  ddur_help              - Show this help message
  ddur_summary           - Show complete workflow overview
  ddur_ls                - List all runs with status
  ddur_new <run-name>    - Create new run (prompts for URL/objective)
  ddur_status [run-name] - Show current run state and progress
  ddur_baseline <run>    - Capture DOM baseline using Playwright
  ddur_augment <run>     - Query LLM for context augmentation
  ddur_prompt <run>      - Generate DDUR prompt with $$substitutions
  ddur_apply <run>       - Apply changes and capture new state
  ddur_verify <run>      - Compare baseline vs after-change
  ddur_log <run>         - Generate final JSON log entry
  ddur_clean <run>       - Archive completed run

Development Functions:
  ddur_console <run>     - Open Chrome DevTools console for debugging
  ddur_cost <run>        - Show token usage and costs via melvin
  ddur_diff <run>        - Show DOM differences between states
  ddur_retry <run>       - Retry failed step in current loop

File Conventions:
  runs/<run-name>/
    ├── meta/              # Run metadata
    │   ├── objective.txt  # UI objective description
    │   ├── url.txt        # Target URL
    │   ├── state.txt      # Current run state
    │   └── loop.txt       # Current loop iteration
    ├── chrome-console/    # Chrome DevTools interaction
    │   ├── in/            # Commands sent to console
    │   └── out/           # Console output/responses
    ├── playwright/        # Playwright test specs
    │   ├── baseline.js    # DOM capture script
    │   └── verify.js      # Verification script
    ├── dom/               # DOM state captures
    │   ├── baseline.json  # Initial DOM state
    │   └── after.json     # Post-change DOM state
    ├── qa/                # LLM interactions via qa.sh
    │   ├── augment/       # Context augmentation queries
    │   └── prompts/       # Generated DDUR prompts
    └── logs/              # Final structured logs
        └── ddur-log.json  # Complete cycle log

Variable Substitutions in Prompts:
  $$url                  - Target URL from url.txt
  $$objective            - Objective from objective.txt
  $$baseline             - Path to baseline.json
  $$after                - Path to after.json
  $$console_in           - Path to chrome-console/in/
  $$console_out          - Path to chrome-console/out/
EOF
}

ddur_ls() {
    if [ ! -d "$RUNS_DIR" ] || [ -z "$(ls -A "$RUNS_DIR" 2>/dev/null)" ]; then
        echo "No D2UR runs found."
        return
    fi
    
    echo "D2UR Runs:"
    printf "%-20s %-12s %-8s %s\n" "RUN NAME" "STATE" "LOOP" "OBJECTIVE"
    printf "%-20s %-12s %-8s %s\n" "--------" "-----" "----" "---------"
    
    for run_dir in "$RUNS_DIR"/*; do
        if [ -d "$run_dir" ]; then
            local run_name=$(basename "$run_dir")
            local state=$(cat "$run_dir/meta/state.txt" 2>/dev/null || echo "UNKNOWN")
            local loop=$(cat "$run_dir/meta/loop.txt" 2>/dev/null || echo "0")
            local objective=$(head -n1 "$run_dir/meta/objective.txt" 2>/dev/null | cut -c1-40)
            printf "%-20s %-12s %-8s %s\n" "$run_name" "$state" "$loop" "$objective"
        fi
    done
}

ddur_new() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        read -p "Enter run name: " run_name
    fi
    
    if [ -z "$run_name" ]; then
        echo "Run name cannot be empty. Aborting."
        return 1
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ -d "$run_dir" ]; then
        echo "Run '$run_name' already exists. Use ddur_status to check it."
        return 1
    fi
    
    # Create directory structure
    mkdir -p "$run_dir"/{meta,chrome-console/{in,out},playwright,dom,qa/{augment,prompts},logs}
    
    # Gather run parameters
    local endpoint_url objective
    read -p "Enter target URL: " endpoint_url
    read -p "Describe UI objective: " objective
    
    if [ -z "$endpoint_url" ] || [ -z "$objective" ]; then
        echo "URL and objective cannot be empty. Aborting."
        rm -rf "$run_dir"
        return 1
    fi
    
    # Initialize run metadata
    echo "$objective" > "$run_dir/meta/objective.txt"
    echo "$endpoint_url" > "$run_dir/meta/url.txt"
    echo "$STATE_INIT" > "$run_dir/meta/state.txt"
    echo "1" > "$run_dir/meta/loop.txt"
    date -Iseconds > "$run_dir/meta/created.txt"
    
    # Log creation in developer notebook style
    _ddur_log_step "$run_name" "RUN_CREATED" "Created new D2UR run: $run_name"
    _ddur_log_step "$run_name" "RUN_CREATED" "URL: $endpoint_url"
    _ddur_log_step "$run_name" "RUN_CREATED" "Objective: $objective"
    
    echo "✓ New D2UR run '$run_name' created"
    echo "  Next: ddur_baseline $run_name"
}

ddur_status() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        # Show status of most recent run
        run_name=$(ls -t "$RUNS_DIR" 2>/dev/null | head -n1)
        if [ -z "$run_name" ]; then
            echo "No runs found. Create one with: ddur_new <name>"
            return 1
        fi
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ ! -d "$run_dir" ]; then
        echo "Run '$run_name' not found."
        return 1
    fi
    
    local state=$(cat "$run_dir/meta/state.txt" 2>/dev/null || echo "UNKNOWN")
    local loop=$(cat "$run_dir/meta/loop.txt" 2>/dev/null || echo "0")
    local objective=$(cat "$run_dir/meta/objective.txt" 2>/dev/null || echo "No objective")
    local url=$(cat "$run_dir/meta/url.txt" 2>/dev/null || echo "No URL")
    
    echo "D2UR Run Status: $run_name"
    echo "  State: $state (Loop $loop)"
    echo "  URL: $url"
    echo "  Objective: $objective"
    
    # Show recent log entries
    if [ -f "$run_dir/logs/steps.log" ]; then
        echo "  Recent steps:"
        tail -n 5 "$run_dir/logs/steps.log" | sed 's/^/    /'
    fi
    
    # Suggest next action based on state
    case "$state" in
        "$STATE_INIT")     echo "  Next: ddur_baseline $run_name" ;;
        "$STATE_BASELINE") echo "  Next: ddur_augment $run_name (optional) or ddur_prompt $run_name" ;;
        "$STATE_AUGMENT")  echo "  Next: ddur_prompt $run_name" ;;
        "$STATE_PROMPT")   echo "  Next: ddur_apply $run_name" ;;
        "$STATE_APPLY")    echo "  Next: ddur_verify $run_name" ;;
        "$STATE_VERIFY")   echo "  Next: ddur_log $run_name (if success) or ddur_retry $run_name" ;;
    esac
}

# === INTERNAL HELPER FUNCTIONS ===

_ddur_log_step() {
    local run_name="$1"
    local step_type="$2"
    local message="$3"
    local run_dir="$RUNS_DIR/$run_name"
    
    mkdir -p "$run_dir/logs"
    local timestamp=$(date -Iseconds)
    echo "[$timestamp] [$step_type] $message" >> "$run_dir/logs/steps.log"
}

_ddur_set_state() {
    local run_name="$1"
    local new_state="$2"
    local run_dir="$RUNS_DIR/$run_name"
    
    echo "$new_state" > "$run_dir/meta/state.txt"
    _ddur_log_step "$run_name" "STATE_CHANGE" "State changed to: $new_state"
}

_ddur_increment_loop() {
    local run_name="$1"
    local run_dir="$RUNS_DIR/$run_name"
    
    local current_loop=$(cat "$run_dir/meta/loop.txt" 2>/dev/null || echo "1")
    local new_loop=$((current_loop + 1))
    echo "$new_loop" > "$run_dir/meta/loop.txt"
    _ddur_log_step "$run_name" "LOOP_INCREMENT" "Starting loop iteration: $new_loop"
}

# === PLACEHOLDER FUNCTIONS (TO BE IMPLEMENTED) ===

ddur_baseline() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        echo "Usage: ddur_baseline <run-name>"
        return 1
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ ! -d "$run_dir" ]; then
        echo "Run '$run_name' not found."
        return 1
    fi
    
    local url=$(cat "$run_dir/meta/url.txt" 2>/dev/null)
    if [ -z "$url" ]; then
        echo "No URL found for run '$run_name'"
        return 1
    fi
    
    _ddur_log_step "$run_name" "BASELINE_START" "Starting baseline capture for URL: $url"
    
    # Generate Playwright script from boilerplate
    local baseline_script="$run_dir/playwright/baseline.js"
    local baseline_output="$run_dir/dom/baseline.json"
    
    # Create the customized Playwright script
    sed -e "s|{{URL}}|$url|g" \
        -e "s|{{RUN_NAME}}|$run_name|g" \
        -e "s|{{OUTPUT_PATH}}|$(realpath "$baseline_output")|g" \
        "$DDUR_ROOT/playwright/boilerplate-baseline.js" > "$baseline_script"
    
    _ddur_log_step "$run_name" "BASELINE_SCRIPT" "Generated Playwright script: $baseline_script"
    
    # Check if Node.js and Playwright are available
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js not found. Please install Node.js to run Playwright scripts."
        return 1
    fi
    
    # Execute the Playwright script
    echo "Executing baseline capture..."
    echo "  Script: $baseline_script"
    echo "  Output: $baseline_output"
    echo "  URL: $url"
    
    cd "$run_dir" || return 1
    
    # Run the Playwright script and capture output
    local playwright_log="$run_dir/logs/playwright-baseline.log"
    if node "$baseline_script" 2>&1 | tee "$playwright_log"; then
        if [ -f "$baseline_output" ]; then
            local element_count=$(jq -r '.documentElement | if . then "elements captured" else "no elements" end' "$baseline_output" 2>/dev/null || echo "unknown")
            _ddur_log_step "$run_name" "BASELINE_SUCCESS" "Baseline captured successfully: $element_count"
            _ddur_set_state "$run_name" "$STATE_BASELINE"
            
            echo "✓ Baseline capture completed"
            echo "  DOM state saved to: $baseline_output"
            echo "  Playwright log: $playwright_log"
            echo "  Next: ddur_augment $run_name (optional) or ddur_prompt $run_name"
        else
            _ddur_log_step "$run_name" "BASELINE_FAIL" "Baseline file not created"
            echo "✗ Baseline capture failed - no output file created"
            return 1
        fi
    else
        _ddur_log_step "$run_name" "BASELINE_FAIL" "Playwright script execution failed"
        echo "✗ Baseline capture failed - check $playwright_log for details"
        return 1
    fi
}

ddur_augment() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        echo "Usage: ddur_augment <run-name>"
        return 1
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ ! -d "$run_dir" ]; then
        echo "Run '$run_name' not found."
        return 1
    fi
    
    # Check if qa.sh functions are available
    if ! command -v qa_query &> /dev/null; then
        echo "Error: qa.sh not sourced. Please run: source /path/to/qa.sh"
        echo "  (qa_query function not found)"
        return 1
    fi
    
    local objective=$(cat "$run_dir/meta/objective.txt" 2>/dev/null)
    local url=$(cat "$run_dir/meta/url.txt" 2>/dev/null)
    local baseline_file="$run_dir/dom/baseline.json"
    
    if [ ! -f "$baseline_file" ]; then
        echo "No baseline found. Run: ddur_baseline $run_name"
        return 1
    fi
    
    _ddur_log_step "$run_name" "AUGMENT_START" "Starting LLM augmentation via qa.sh"
    
    # Create augmentation prompt
    local augment_prompt="$run_dir/qa/augment/prompt.txt"
    mkdir -p "$(dirname "$augment_prompt")"
    
    # Extract key information from baseline for context
    local dom_summary
    dom_summary=$(jq -r '
        {
            url: .url,
            title: .title,
            viewport: .viewport,
            elementCount: (.documentElement | if . then "present" else "missing" end),
            commonElements: {
                body: (.commonSelectors.body | if . then "present" else "missing" end),
                header: (.commonSelectors.header | if . then "present" else "missing" end),
                nav: (.commonSelectors.nav | if . then "present" else "missing" end),
                main: (.commonSelectors.main | if . then "present" else "missing" end),
                sidebar: (.commonSelectors.sidebar | if . then "present" else "missing" end)
            },
            consoleMessageCount: (.consoleMessages | length)
        }
    ' "$baseline_file" 2>/dev/null || echo "Error parsing baseline")
    
    # Create comprehensive augmentation prompt
    cat > "$augment_prompt" << EOF
D2UR Context Augmentation Request

OBJECTIVE: $objective
TARGET URL: $url

BASELINE DOM SUMMARY:
$dom_summary

AUGMENTATION REQUEST:
Please analyze this UI objective and provide context that would help with implementation:

1. TECHNICAL ANALYSIS:
   - What specific DOM elements or CSS selectors might be involved?
   - What CSS properties are likely to need modification?
   - Are there common UI patterns or frameworks that might be relevant?

2. IMPLEMENTATION STRATEGY:
   - What are the most likely approaches to achieve this objective?
   - What potential challenges or edge cases should be considered?
   - Are there accessibility or responsive design considerations?

3. DEBUGGING GUIDANCE:
   - What should we look for in the DOM structure?
   - What CSS specificity issues might arise?
   - What browser developer tools would be most helpful?

4. VERIFICATION CRITERIA:
   - How can we measure success objectively?
   - What specific DOM properties should we compare before/after?
   - What visual indicators would confirm the change worked?

Please provide specific, actionable guidance for this D2UR cycle.
EOF
    
    _ddur_log_step "$run_name" "AUGMENT_PROMPT" "Created augmentation prompt: $augment_prompt"
    
    # Send to LLM via qa.sh
    echo "Querying LLM for context augmentation..."
    echo "  Prompt file: $augment_prompt"
    
    local augment_response="$run_dir/qa/augment/response.txt"
    local augment_log="$run_dir/qa/augment/qa.log"
    
    # Execute qa_query and capture both output and metadata
    if qa_query "$(cat "$augment_prompt")" > "$augment_response" 2> "$augment_log"; then
        _ddur_log_step "$run_name" "AUGMENT_SUCCESS" "LLM augmentation completed"
        
        # Try to get cost information if melvin functions are available
        local cost_info="N/A"
        if command -v a &> /dev/null; then
            # Get the most recent answer's cost info
            cost_info=$(a 0 2>/dev/null | grep -o '\[.*cents\]' | tail -n1 || echo "N/A")
        fi
        
        _ddur_log_step "$run_name" "AUGMENT_COST" "Query cost: $cost_info"
        _ddur_set_state "$run_name" "$STATE_AUGMENT"
        
        echo "✓ Augmentation completed"
        echo "  Response saved to: $augment_response"
        echo "  Cost: $cost_info"
        echo "  Next: ddur_prompt $run_name"
        
        # Show a preview of the response
        echo ""
        echo "=== AUGMENTATION PREVIEW ==="
        head -n 10 "$augment_response"
        echo "..."
        echo "==========================="
        
    else
        _ddur_log_step "$run_name" "AUGMENT_FAIL" "LLM query failed"
        echo "✗ Augmentation failed - check $augment_log for details"
        return 1
    fi
}

ddur_prompt() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        echo "Usage: ddur_prompt <run-name>"
        return 1
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ ! -d "$run_dir" ]; then
        echo "Run '$run_name' not found."
        return 1
    fi
    
    local objective=$(cat "$run_dir/meta/objective.txt" 2>/dev/null)
    local url=$(cat "$run_dir/meta/url.txt" 2>/dev/null)
    local baseline_file="$run_dir/dom/baseline.json"
    
    _ddur_log_step "$run_name" "PROMPT_START" "Generating DDUR prompt with variable substitutions"
    
    # Create the DDUR prompt template with $$substitutions
    local prompt_template="$run_dir/qa/prompts/template.txt"
    local final_prompt="$run_dir/qa/prompts/final.txt"
    mkdir -p "$(dirname "$prompt_template")"
    
    # Create comprehensive DDUR prompt template
    cat > "$prompt_template" << 'EOF'
# D2UR (Data-Driven UI Refinement) Implementation Prompt

## OBJECTIVE
$$objective

## TARGET CONTEXT
- URL: $$url
- Baseline DOM State: $$baseline
- Console Input Directory: $$console_in
- Console Output Directory: $$console_out

## TASK
You are implementing a precise UI change using the D2UR methodology. You have access to:

1. **Baseline DOM State** ($$baseline): Complete DOM structure with computed styles
2. **Chrome Console Interface**: Send commands via $$console_in, receive output via $$console_out
3. **Augmentation Context**: Additional LLM analysis (if available)

## IMPLEMENTATION REQUIREMENTS

### 1. ANALYSIS PHASE
- Examine the baseline DOM structure in $$baseline
- Identify target elements and their current properties
- Determine the specific changes needed to achieve the objective

### 2. IMPLEMENTATION STRATEGY
- Provide specific CSS selectors for target elements
- Specify exact CSS property changes needed
- Consider CSS specificity and override strategies
- Account for responsive design and accessibility

### 3. VERIFICATION PLAN
- Define measurable success criteria
- Specify which DOM properties to compare before/after
- Identify visual indicators of successful implementation

### 4. CHROME CONSOLE COMMANDS
Generate specific JavaScript commands to:
- Inspect target elements: `document.querySelector('selector')`
- Check computed styles: `getComputedStyle(element)`
- Test CSS changes: `element.style.property = 'value'`
- Verify measurements: `element.getBoundingClientRect()`

## OUTPUT FORMAT
Provide your response as structured sections:

```
ANALYSIS:
[Your analysis of the current state and required changes]

SELECTORS:
[Specific CSS selectors for target elements]

CSS_CHANGES:
[Exact CSS properties and values to modify]

CONSOLE_COMMANDS:
[JavaScript commands to run in Chrome DevTools]

VERIFICATION:
[How to measure success and what to compare]

IMPLEMENTATION_NOTES:
[Any additional considerations or potential issues]
```

## CONSTRAINTS
- Changes must be precise and measurable
- Avoid breaking existing functionality
- Consider cross-browser compatibility
- Maintain accessibility standards
- Use existing CSS classes/IDs when possible

Begin your analysis using the provided baseline data.
EOF
    
    # Perform $$variable substitutions
    local augment_response="$run_dir/qa/augment/response.txt"
    local augment_context=""
    if [ -f "$augment_response" ]; then
        augment_context="

## AUGMENTATION CONTEXT
$(cat "$augment_response")"
    fi
    
    # Create final prompt with substitutions
    sed -e "s|\$\$objective|$objective|g" \
        -e "s|\$\$url|$url|g" \
        -e "s|\$\$baseline|$(realpath "$baseline_file")|g" \
        -e "s|\$\$console_in|$(realpath "$run_dir/chrome-console/in")|g" \
        -e "s|\$\$console_out|$(realpath "$run_dir/chrome-console/out")|g" \
        "$prompt_template" > "$final_prompt"
    
    # Add augmentation context if available
    if [ -n "$augment_context" ]; then
        echo "$augment_context" >> "$final_prompt"
    fi
    
    _ddur_log_step "$run_name" "PROMPT_GENERATED" "Final DDUR prompt created: $final_prompt"
    _ddur_set_state "$run_name" "$STATE_PROMPT"
    
    echo "✓ DDUR prompt generated"
    echo "  Template: $prompt_template"
    echo "  Final prompt: $final_prompt"
    echo "  Next: ddur_apply $run_name"
    
    # Show prompt preview
    echo ""
    echo "=== PROMPT PREVIEW ==="
    head -n 20 "$final_prompt"
    echo "..."
    echo "======================"
    echo ""
    echo "To send this prompt to LLM: qa_query \"\$(cat '$final_prompt')\""
}

ddur_apply() {
    local run_name="$1"
    echo "TODO: Implement ddur_apply - Apply changes and capture new state"
    _ddur_set_state "$run_name" "$STATE_APPLY"
}

ddur_verify() {
    local run_name="$1"
    echo "TODO: Implement ddur_verify - Compare baseline vs after states"
    _ddur_set_state "$run_name" "$STATE_VERIFY"
}

ddur_log() {
    local run_name="$1"
    echo "TODO: Implement ddur_log - Generate final JSON log"
    _ddur_set_state "$run_name" "$STATE_SUCCESS"
}

ddur_console() {
    local run_name="$1"
    echo "TODO: Implement ddur_console - Chrome DevTools console interface"
}

ddur_cost() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        echo "Usage: ddur_cost <run-name>"
        return 1
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ ! -d "$run_dir" ]; then
        echo "Run '$run_name' not found."
        return 1
    fi
    
    echo "D2UR Cost Analysis: $run_name"
    echo "================================"
    
    # Check if melvin/qa functions are available
    if ! command -v a &> /dev/null; then
        echo "Warning: melvin.sh not sourced (no 'a' function found)"
        echo "Cost tracking requires qa.sh and melvin.sh to be sourced"
        return 1
    fi
    
    # Parse step logs to find LLM queries
    local steps_log="$run_dir/logs/steps.log"
    if [ ! -f "$steps_log" ]; then
        echo "No steps log found"
        return 1
    fi
    
    # Count queries and estimate costs
    local augment_queries=$(grep -c "AUGMENT_SUCCESS" "$steps_log" 2>/dev/null || echo "0")
    local total_queries=$augment_queries
    
    echo "Query Summary:"
    echo "  Augmentation queries: $augment_queries"
    echo "  Total LLM queries: $total_queries"
    echo ""
    
    # Show recent query costs if available
    if [ "$total_queries" -gt 0 ]; then
        echo "Recent Query Costs (via melvin):"
        # Show last few answers with costs
        for i in $(seq 0 $((total_queries - 1))); do
            if command -v a &> /dev/null; then
                local cost_line=$(a "$i" 2>/dev/null | grep '\[.*cents\]' | tail -n1)
                if [ -n "$cost_line" ]; then
                    echo "  Query $((i + 1)): $cost_line"
                fi
            fi
        done
    else
        echo "No LLM queries recorded yet"
    fi
    
    echo ""
    echo "Cost Tracking Notes:"
    echo "  - Costs are tracked automatically when using qa_query"
    echo "  - Use 'a 0' to see most recent query cost"
    echo "  - Use '/models' (if melvin sourced) to see rate table"
}

ddur_diff() {
    local run_name="$1"
    echo "TODO: Implement ddur_diff - Show DOM differences"
}

ddur_retry() {
    local run_name="$1"
    echo "TODO: Implement ddur_retry - Retry failed step"
    _ddur_increment_loop "$run_name"
}

ddur_clean() {
    local run_name="$1"
    if [ -z "$run_name" ]; then
        echo "Usage: ddur_clean <run-name>"
        return 1
    fi
    
    local run_dir="$RUNS_DIR/$run_name"
    if [ ! -d "$run_dir" ]; then
        echo "Run '$run_name' not found."
        return 1
    fi
    
    local state=$(cat "$run_dir/meta/state.txt" 2>/dev/null || echo "UNKNOWN")
    
    if [ "$state" != "$STATE_SUCCESS" ] && [ "$state" != "$STATE_FAIL" ]; then
        echo "Warning: Run '$run_name' is not in final state ($state)"
        read -p "Archive anyway? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "Archive cancelled"
            return 1
        fi
    fi
    
    # Create archive directory
    local archive_dir="$DDUR_ROOT/archive/$(date +%Y%m%d)"
    mkdir -p "$archive_dir"
    
    # Move run to archive
    local archive_path="$archive_dir/$run_name"
    mv "$run_dir" "$archive_path"
    
    _ddur_log_step "$run_name" "ARCHIVED" "Run archived to: $archive_path" 
    
    echo "✓ Run '$run_name' archived to: $archive_path"
}

# === DDUR WORKFLOW SUMMARY ===
ddur_summary() {
    cat << 'EOF'
D2UR (Data-Driven UI Refinement) Workflow Summary

TYPICAL WORKFLOW:
1. ddur_new <run-name>          # Create new run, set objective & URL
2. ddur_baseline <run-name>     # Capture DOM baseline via Playwright  
3. ddur_augment <run-name>      # Optional: Get LLM context via qa.sh
4. ddur_prompt <run-name>       # Generate DDUR prompt with $$substitutions
5. [Manual: Send prompt to LLM and implement changes]
6. ddur_apply <run-name>        # Capture post-change state
7. ddur_verify <run-name>       # Compare baseline vs after
8. ddur_log <run-name>          # Generate final JSON log
9. ddur_clean <run-name>        # Archive completed run

MONITORING & DEBUGGING:
- ddur_ls                       # List all runs with status
- ddur_status [run-name]        # Show detailed run status
- ddur_cost <run-name>          # Show LLM query costs via melvin
- ddur_diff <run-name>          # Show DOM differences
- ddur_console <run-name>       # Chrome DevTools console interface

INTEGRATION REQUIREMENTS:
- Node.js + Playwright for DOM capture
- qa.sh for LLM queries (requires OPENAI_API key)
- melvin.sh for cost tracking (optional but recommended)
- jq for JSON processing

The D2UR system creates a systematic, data-driven approach to UI changes
with full traceability, cost tracking, and verification capabilities.
EOF
}
