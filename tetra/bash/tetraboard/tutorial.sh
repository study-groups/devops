#!/usr/bin/env bash
# tetraboard tutorial.sh - Interactive getting started tutorial for TetraBoard
set -euo pipefail

TETRABOARD_DIR="${BASH_SOURCE[0]%/*}"
TETRABOARD_SCRIPT="$TETRABOARD_DIR/tetraboard.sh"

# Tutorial state
TUTORIAL_STEP=0
TUTORIAL_COMPLETED_STEPS=()

# REPL history
REPL_HISTORY=()

show_welcome() {
    cat <<'EOF'

🧠 TetraBoard Tutorial
=====================

Welcome! TetraBoard monitors your TETRA system.

Getting started:
- Press <ENTER> to see options
- Type 'demo' for a quick example
- Type 'help' for more info
- Type 'exit' when done

EOF
}

show_options() {
    echo
    echo "🎯 Quick Options:"
    echo "  demo     - See system status"
    echo "  generate - Create dashboard"
    echo "  help     - Get help"
    echo "  exit     - Quit"
    echo
    echo "💡 Try 'demo' first!"
    echo
}

show_commands() {
    echo
    echo "🔧 TetraBoard Commands:"
    echo "  ./tetraboard.sh generate   - Create dashboard"
    echo "  ./tetraboard.sh watch      - Live monitoring"
    echo "  ./tetraboard.sh summary    - Quick status"
    echo "  ./tetraboard.sh ulm-stats  - ULM performance"
    echo "  ./tetraboard.sh rag-history - RAG activity"
    echo
    echo "Options: --period <sec>, --output <file>"
    echo
    echo "💡 Try 'demo' or 'generate' next!"
    echo
}

show_term_help() {
    local term="$1"
    local help_file="$TETRABOARD_DIR/help-terms.md"

    echo
    echo "📖 Help: $term"
    echo "==============="

    # Normalize term for lookup
    local normalized_term="${term// /-}"
    normalized_term="${normalized_term,,}"

    case "$normalized_term" in
        "ulm-episodes")
            echo "💡 ULM Episodes"
            echo "Definition: Training episodes completed by the Unix Language Model"
            echo "What it means: Each episode represents a learning cycle where ULM"
            echo "processes queries and improves its attention mechanisms."
            echo "Good values: 10+ episodes show active learning. 0 means no training yet."
            ;;
        "rag-generations")
            echo "🤖 RAG Generations"
            echo "Definition: Total number of context generations by the RAG system"
            echo "What it means: Each generation creates optimized code context for AI models."
            echo "Typical range: 0-1000+ depending on usage patterns."
            ;;
        "success-rate")
            echo "📊 Success Rate"
            echo "Definition: Percentage of RAG generations that completed successfully"
            echo "What it means: Measures system reliability. High success rates (80%+)"
            echo "indicate stable operation. Lower rates may suggest issues."
            echo "Target: Above 75% is good, 90%+ is excellent."
            ;;
        "popular-agent")
            echo "🎯 Popular Agent"
            echo "Definition: Most frequently used AI agent for generations"
            echo "What it means: Shows which AI model is being used most often."
            echo "Common values: claude-code, openai, anthropic, local-model"
            ;;
        "ulm-engine")
            echo "⚙️ ULM Engine"
            echo "Definition: Unix Language Model processing engine"
            echo "Status values:"
            echo "  ✅ Active: Engine running and processing"
            echo "  🟡 Initializing: Starting up or loading models"
            echo "  ❌ Offline: Not running or misconfigured"
            ;;
        "attention-heads")
            echo "🧠 Attention Heads"
            echo "Definition: Four specialized ranking mechanisms in ULM"
            echo "Types:"
            echo "  🎯 Functional: Ranks functions, methods, procedures"
            echo "  🏗️ Structural: Analyzes classes, interfaces, architecture"
            echo "  ⏰ Temporal: Considers recency and modification patterns"
            echo "  🔗 Dependency: Maps imports, exports, connections"
            ;;
        "multicat")
            echo "📄 MULTICAT Format"
            echo "Definition: Multi-file concatenation format optimized for AI models"
            echo "What it means: Combines relevant code files with proper headers"
            echo "and context markers for optimal AI comprehension."
            echo "Benefits: Better than simple concatenation - preserves structure."
            ;;
        *)
            echo "Term '$term' not found in help system."
            echo
            echo "Available terms:"
            echo "  ulm-episodes, rag-generations, success-rate, popular-agent,"
            echo "  ulm-engine, attention-heads, multicat"
            ;;
    esac
    echo
}

show_help() {
    local term="${1:-}"

    if [[ -n "$term" ]]; then
        show_term_help "$term"
        return
    fi

    echo
    echo "📚 TetraBoard Help"
    echo "================="
    echo
    echo "🚀 Start Here:"
    echo "  demo     - See system status example"
    echo "  generate - Create your first dashboard"
    echo "  learn    - Understand concepts"
    echo
    echo "🎯 More Commands:"
    echo "  cmd      - Show all TetraBoard commands"
    echo "  watch    - Live monitoring tutorial"
    echo "  status   - Tutorial progress"
    echo "  help <term> - Explain terms (e.g., 'help ulm-episodes')"
    echo
    echo "💡 What is TetraBoard?"
    echo "Monitors TETRA system: ULM training, RAG generations, AI agents"
    echo
    echo "Available terms: ulm-episodes, rag-generations, success-rate"
    echo
}

show_concepts() {
    echo
    echo "🧠 Key Concepts"
    echo "=============="
    echo
    echo "🎯 ULM: Unix Language Model"
    echo "  - Ranks code files by relevance"
    echo "  - Uses transformer-style attention"
    echo "  - Learns from usage patterns"
    echo
    echo "🤖 RAG: Retrieval Augmented Generation"
    echo "  - Creates optimal code context"
    echo "  - Supports multiple AI agents"
    echo "  - Tracks success rates"
    echo
    echo "📊 Dashboard: Real-time monitoring"
    echo "  - System status, metrics, trends"
    echo
    echo "💡 Try 'generate' to see it working!"
    echo
}

run_demo() {
    echo
    echo "🚀 Running Demo Command..."
    echo "Command: ./tetraboard.sh summary"
    echo
    echo "📊 System Status Table:"
    echo "======================"
    printf "%-20s | %-15s | %s\n" "Metric" "Value" "Description"
    printf "%-20s-+-%-15s-+-%s\n" "--------------------" "---------------" "---------------------------"

    if [[ -x "$TETRABOARD_SCRIPT" ]]; then
        # Get actual output and parse it
        local summary_output
        summary_output=$("$TETRABOARD_SCRIPT" summary 2>/dev/null || echo "ULM Episodes: 0|RAG Generations: 4|Success Rate: 75.00%|Popular Agent: agent|Last Updated: $(date '+%Y-%m-%d %H:%M:%S')")

        # Parse the output (assuming format from tetraboard.sh)
        local ulm_episodes=$(echo "$summary_output" | grep -o 'ULM Episodes: [0-9]*' | cut -d' ' -f3 || echo "0")
        local rag_gens=$(echo "$summary_output" | grep -o 'RAG Generations: *[0-9]*' | sed 's/.*: *//' || echo "4")
        local success_rate=$(echo "$summary_output" | grep -o 'Success Rate: [0-9.]*%' | cut -d' ' -f3 || echo "75.00%")
        local popular_agent=$(echo "$summary_output" | grep -o 'Popular Agent: [a-z-]*' | cut -d' ' -f3 || echo "agent")

        printf "%-20s | %-15s | %s\n" "ULM Episodes" "$ulm_episodes" "Training cycles completed"
        printf "%-20s | %-15s | %s\n" "RAG Generations" "$rag_gens" "Context generations made"
        printf "%-20s | %-15s | %s\n" "Success Rate" "$success_rate" "Successful generation %"
        printf "%-20s | %-15s | %s\n" "Popular Agent" "$popular_agent" "Most used AI model"
        printf "%-20s | %-15s | %s\n" "Data Store" "✅ Ready" "State storage available"
    else
        # Simulated output
        printf "%-20s | %-15s | %s\n" "ULM Episodes" "0" "Training cycles completed"
        printf "%-20s | %-15s | %s\n" "RAG Generations" "4" "Context generations made"
        printf "%-20s | %-15s | %s\n" "Success Rate" "75.00%" "Successful generation %"
        printf "%-20s | %-15s | %s\n" "Popular Agent" "claude-code" "Most used AI model"
        printf "%-20s | %-15s | %s\n" "Data Store" "🟡 Simulated" "Demo mode active"
    fi

    echo
    echo "📖 Quick Explanations:"
    echo "  • ULM Episodes: Training cycles (0 = no training yet)"
    echo "  • RAG Generations: Context windows created"
    echo "  • Success Rate: % completed (>75% is good)"
    echo "  • Popular Agent: Most used AI model"
    echo
    echo "💡 Type 'help <term>' for details (e.g., 'help success-rate')"
    echo "✅ Try 'generate' next to create your dashboard!"
    echo

    # Mark as completed
    if [[ ! " ${TUTORIAL_COMPLETED_STEPS[*]} " =~ " demo " ]]; then
        TUTORIAL_COMPLETED_STEPS+=("demo")
    fi
}

run_generate() {
    echo
    echo "🔧 Generating Your First Dashboard..."
    echo "Command: ./tetraboard.sh generate"
    echo

    if [[ -x "$TETRABOARD_SCRIPT" ]]; then
        echo "Running actual command..."
        "$TETRABOARD_SCRIPT" generate && {
            echo
            echo "✅ Dashboard generated successfully!"
            echo "📄 Output saved to: tetraboard.md"
            echo "🔍 You can view it with: cat tetraboard.md"
            echo
            echo "💡 Next steps:"
            echo "  - Type 'watch' to start live monitoring"
            echo "  - Type 'learn' to understand what you're seeing"
            echo

            # Mark as completed
            if [[ ! " ${TUTORIAL_COMPLETED_STEPS[*]} " =~ " generate " ]]; then
                TUTORIAL_COMPLETED_STEPS+=("generate")
            fi
        } || {
            echo "❌ Generation failed. This might be normal if ULM/RAG aren't set up yet."
            echo "💡 TetraBoard will show initialization status and help you get started."
        }
    else
        echo "❌ TetraBoard script not found or not executable"
        echo "💡 Make sure you're in the tetraboard directory and tetraboard.sh exists"
    fi
    echo
}

run_watch_tutorial() {
    echo
    echo "👀 Live Monitoring Tutorial"
    echo "========================="
    echo
    echo "Live monitoring refreshes your dashboard automatically."
    echo
    echo "Command: ./tetraboard.sh watch --period 10"
    echo "This would refresh every 10 seconds (default is 30)."
    echo
    echo "💡 What you'll see:"
    echo "  - Real-time system status updates"
    echo "  - New RAG generations as they happen"
    echo "  - ULM training progress"
    echo "  - Agent performance trends"
    echo
    echo "🛑 To start actual monitoring, exit this tutorial and run:"
    echo "   ./tetraboard.sh watch"
    echo
    echo "⚡ Press Ctrl+C to stop monitoring when it's running."
    echo

    # Mark as completed
    if [[ ! " ${TUTORIAL_COMPLETED_STEPS[*]} " =~ " watch " ]]; then
        TUTORIAL_COMPLETED_STEPS+=("watch")
    fi
}

show_status() {
    echo
    echo "📊 Tutorial Progress"
    echo "=================="
    echo
    echo "Completed steps:"
    if [[ ${#TUTORIAL_COMPLETED_STEPS[@]} -eq 0 ]]; then
        echo "  (none yet)"
    else
        for step in "${TUTORIAL_COMPLETED_STEPS[@]}"; do
            echo "  ✅ $step"
        done
    fi
    echo
    echo "Available steps:"
    echo "  📊 demo     - Run a quick demo command"
    echo "  🔧 generate - Generate your first dashboard"
    echo "  👀 watch    - Learn about live monitoring"
    echo "  🧠 learn    - Understand TetraBoard concepts"
    echo
    echo "Progress: ${#TUTORIAL_COMPLETED_STEPS[@]}/4 steps completed"
    echo
}

# Main REPL loop
run_tutorial_repl() {
    show_welcome

    while true; do
        local input

        # Simple readline prompt
        if ! read -e -r -p "tetraboard-tutorial> " input; then
            echo "Goodbye!"
            break
        fi

        # Handle empty input - show options
        if [[ -z "$input" ]]; then
            show_options
            continue
        fi

        # Add to history
        REPL_HISTORY+=("$input")

        # Process command
        case "$input" in
            "exit"|"q"|"quit")
                echo
                echo "🎓 Tutorial completed!"
                echo "Next steps:"
                echo "  1. Run './tetraboard.sh generate' to create dashboards"
                echo "  2. Run './tetraboard.sh watch' for live monitoring"
                echo "  3. See getting-started.txt for more information"
                echo
                echo "Happy monitoring! 🚀"
                return 0
                ;;
            "help"|"h"|"?")
                show_help
                ;;
            help\ *)
                local term="${input#help }"
                show_help "$term"
                ;;
            "cmd"|"commands")
                show_commands
                ;;
            "demo"|"d")
                run_demo
                ;;
            "learn"|"concepts")
                show_concepts
                ;;
            "generate"|"gen"|"g")
                run_generate
                ;;
            "watch"|"w")
                run_watch_tutorial
                ;;
            "status"|"progress")
                show_status
                ;;
            "")
                show_options
                ;;
            *)
                echo "Unknown command: '$input'"
                echo "Type 'help' for available commands, or press <ENTER> for options."
                ;;
        esac
    done
}

# Main entry point
main() {
    run_tutorial_repl
}

# Only run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi