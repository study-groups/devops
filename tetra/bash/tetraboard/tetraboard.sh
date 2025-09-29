#!/usr/bin/env bash
# tetraboard.sh - Live dashboard for ULM and RAG system performance
set -euo pipefail

TETRABOARD_DIR="${BASH_SOURCE[0]%/*}"
TETRABOARD_DATA_DIR="$TETRABOARD_DIR/data"
TETRABOARD_TEMPLATES_DIR="$TETRABOARD_DIR/templates"

# Paths to other modules
ULM_DIR="$TETRABOARD_DIR/../ulm"
RAG_DIR="$TETRABOARD_DIR/../rag"

# User data directories
TETRA_USER_RAG="${TETRA_DIR:-$HOME/.tetra}/rag"
TETRA_USER_DATA="$TETRA_USER_RAG/state"

# Output file
DASHBOARD_OUTPUT="$TETRABOARD_DIR/tetraboard.md"

# Don't execute main logic if script is being sourced
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

usage() {
    cat <<'EOF'
Usage: tetraboard.sh [COMMAND] [OPTIONS]

COMMANDS:
  generate              Generate dashboard from current state
  watch                 Watch for changes and auto-regenerate
  summary              Show quick system summary
  ulm-stats            Show ULM performance statistics
  rag-history          Show recent RAG generations
  training-runs        Show ULM training run history

OPTIONS:
  --output <file>      Output file (default: tetraboard.md)
  --format <style>     Output format: markdown, html, json
  --live               Include live updating elements
  --period <seconds>   Watch period for auto-refresh (default: 30)

EXAMPLES:
  tetraboard generate
  tetraboard watch --period 10
  tetraboard ulm-stats
  tetraboard rag-history --live
EOF
    exit 1
}

# --- Data Collection ---

collect_ulm_stats() {
    local stats=()

    # ULM training logs
    if [[ -f "$ULM_DIR/logs/training.log" ]]; then
        local total_episodes last_reward last_algorithm
        total_episodes=$(tail -n +2 "$ULM_DIR/logs/training.log" | wc -l)

        if [[ $total_episodes -gt 0 ]]; then
            local last_entry
            last_entry=$(tail -1 "$ULM_DIR/logs/training.log")
            IFS='|' read -r timestamp type episode_id algorithm reward query <<< "$last_entry"

            stats+=("total_episodes=$total_episodes")
            stats+=("last_reward=$reward")
            stats+=("last_algorithm=$algorithm")
            stats+=("last_training=$(date -d "$timestamp" '+%s' 2>/dev/null || echo '0')")
        fi
    fi

    # ULM general usage logs
    if [[ -f "$ULM_DIR/logs/ulm.log" ]]; then
        local rank_count
        rank_count=$(grep "rank_start" "$ULM_DIR/logs/ulm.log" | wc -l)
        stats+=("total_rankings=$rank_count")
    fi

    printf "%s\n" "${stats[@]}"
}

collect_rag_stats() {
    local stats=()

    # RAG state directory
    if [[ -d "$TETRA_USER_DATA" ]]; then
        # Generation history
        if [[ -f "$TETRA_USER_DATA/generations.log" ]]; then
            local total_gens success_count
            total_gens=$(tail -n +2 "$TETRA_USER_DATA/generations.log" | wc -l)
            success_count=$(grep "|success|" "$TETRA_USER_DATA/generations.log" | wc -l)

            stats+=("total_generations=$total_gens")
            stats+=("success_count=$success_count")

            if [[ $total_gens -gt 0 ]]; then
                local success_rate
                success_rate=$(echo "scale=2; $success_count * 100 / $total_gens" | bc)
                stats+=("success_rate=$success_rate")
            fi
        fi

        # Agent usage
        if [[ -f "$TETRA_USER_DATA/agent_usage.log" ]]; then
            local popular_agent
            popular_agent=$(cut -d'|' -f2 "$TETRA_USER_DATA/agent_usage.log" | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
            stats+=("popular_agent=$popular_agent")
        fi
    fi

    printf "%s\n" "${stats[@]}"
}

collect_system_info() {
    local info=()

    info+=("timestamp=$(date '+%Y-%m-%d %H:%M:%S')")
    info+=("hostname=$(hostname)")
    info+=("tetra_src=${TETRA_SRC:-not_set}")
    info+=("tetra_dir=${TETRA_DIR:-not_set}")

    # Module status
    info+=("ulm_available=$([[ -x \"$ULM_DIR/ulm.sh\" ]] && echo 'true' || echo 'false')")
    info+=("rag_available=$([[ -f \"$RAG_DIR/core/multicat/multicat.sh\" ]] && echo 'true' || echo 'false')")

    # File counts
    if [[ -d "$ULM_DIR" ]]; then
        local model_count
        model_count=$(find "$ULM_DIR/models" -name "*.sh" 2>/dev/null | wc -l)
        info+=("ulm_models=$model_count")
    fi

    if [[ -d "$RAG_DIR/agents" ]]; then
        local agent_count
        agent_count=$(find "$RAG_DIR/agents" -name "*.conf" 2>/dev/null | wc -l)
        info+=("agent_profiles=$agent_count")
    fi

    printf "%s\n" "${info[@]}"
}

# --- Dashboard Generation ---

generate_header() {
    local timestamp system_info
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    cat <<EOF
# 🧠 ULM-RAG TetraBoard Dashboard

*Generated: $timestamp*

## System Status

EOF

    declare -A info
    while IFS='=' read -r key value; do
        info["$key"]="$value"
    done < <(collect_system_info)

    echo "| Component | Status | Details |"
    echo "|-----------|--------|---------|"
    echo "| ULM Engine | ${info[ulm_available]=='true' && echo '🟢 Active' || echo '🔴 Inactive'} | ${info[ulm_models]} models loaded |"
    echo "| RAG System | ${info[rag_available]=='true' && echo '🟢 Active' || echo '🔴 Inactive'} | ${info[agent_profiles]} agent profiles |"
    echo "| Data Store | $([[ -d \"$TETRA_USER_DATA\" ]] && echo '🟢 Ready' || echo '🟡 Initializing') | ${TETRA_USER_DATA} |"
    echo
}

generate_ulm_section() {
    cat <<EOF
## 🎯 ULM (Unix Language Model) Performance

### Attention Mechanism Status
EOF

    declare -A ulm_stats
    while IFS='=' read -r key value; do
        ulm_stats["$key"]="$value"
    done < <(collect_ulm_stats)

    if [[ -n "${ulm_stats[total_episodes]:-}" ]]; then
        echo "| Metric | Value | Status |"
        echo "|--------|-------|--------|"
        echo "| Training Episodes | ${ulm_stats[total_episodes]} | 🎯 Active |"
        echo "| Last Reward | ${ulm_stats[last_reward]:-N/A} | $(get_reward_status "${ulm_stats[last_reward]:-0}") |"
        echo "| Last Algorithm | ${ulm_stats[last_algorithm]:-N/A} | 🔄 |"
        echo "| Total Rankings | ${ulm_stats[total_rankings]:-0} | 📊 |"
        echo
    else
        echo "*No training data available yet. Run some ULM training episodes to see performance metrics.*"
        echo
    fi
}

generate_rag_section() {
    cat <<EOF
## 🤖 RAG System Activity

### Generation History
EOF

    declare -A rag_stats
    while IFS='=' read -r key value; do
        rag_stats["$key"]="$value"
    done < <(collect_rag_stats)

    if [[ -n "${rag_stats[total_generations]:-}" ]]; then
        echo "| Metric | Value | Trend |"
        echo "|--------|-------|-------|"
        echo "| Total Generations | ${rag_stats[total_generations]} | 📈 |"
        echo "| Success Rate | ${rag_stats[success_rate]:-0}% | $(get_success_trend "${rag_stats[success_rate]:-0}") |"
        echo "| Popular Agent | ${rag_stats[popular_agent]:-base} | 🎖️ |"
        echo

        # Recent activity
        if [[ -f "$TETRA_USER_DATA/generations.log" ]]; then
            echo "### Recent Generations"
            echo "| Timestamp | Agent | Status | Context Size |"
            echo "|-----------|-------|--------|--------------|"

            tail -5 "$TETRA_USER_DATA/generations.log" | while IFS='|' read -r ts agent files context status; do
                local status_icon
                case "$status" in
                    "success") status_icon="✅" ;;
                    "partial") status_icon="⚠️" ;;
                    "failed") status_icon="❌" ;;
                    *) status_icon="❓" ;;
                esac
                echo "| $ts | $agent | $status_icon $status | ${context}k tokens |"
            done
            echo
        fi
    else
        echo "*No RAG generations recorded yet. Use multicat.sh with --agent to start tracking.*"
        echo
    fi
}

generate_story_section() {
    cat <<EOF
## 📚 The RAG System Story

### Chapter 1: The Query Arrives
EOF

    # Get last query from ULM logs
    if [[ -f "$ULM_DIR/logs/training.log" ]]; then
        local last_query last_algorithm last_reward
        local last_line
        last_line=$(tail -1 "$ULM_DIR/logs/training.log" 2>/dev/null || echo "")

        if [[ -n "$last_line" ]]; then
            IFS='|' read -r timestamp type episode_id algorithm reward query <<< "$last_line"

            echo "*Latest Query*: \"$query\""
            echo "*Processed by*: $algorithm algorithm"
            echo "*Performance*: $reward reward score"
            echo
        fi
    fi

    cat <<EOF
### Chapter 2: Multi-Head Attention at Work

The ULM system processes each query through four attention heads:

- **🎯 Functional Head**: Searches for functions, methods, and procedures
- **🏗️ Structural Head**: Analyzes classes, interfaces, and architecture
- **⏰ Temporal Head**: Considers recency and modification patterns
- **🔗 Dependency Head**: Maps imports, exports, and connections

EOF

    # Show policy if available
    if [[ -f "$ULM_DIR/training/current_policy.conf" ]]; then
        echo "### Current Attention Policy"
        echo "```bash"
        grep "POLICY_PARAMS" "$ULM_DIR/training/current_policy.conf" | head -4
        echo "```"
        echo
    fi

    cat <<EOF
### Chapter 3: The Context Window

Selected code flows through the ULM → RAG pipeline:

1. **Query Processing** → Extract meaningful terms and intent
2. **Multi-Head Scoring** → Rank files by relevance
3. **Context Assembly** → Build optimal MULTICAT format
4. **Agent Formatting** → Apply LLM-specific templates
5. **Generation** → Send to target AI model

### Chapter 4: Learning and Adaptation

The system learns from each generation cycle through reinforcement learning:
- Policy gradient updates based on success/failure
- Multi-armed bandit algorithm selection
- Attention weight optimization over time

EOF

    if [[ -f "$ULM_DIR/logs/training.log" ]]; then
        local episode_count
        episode_count=$(tail -n +2 "$ULM_DIR/logs/training.log" | wc -l)
        echo "*Training Progress*: $episode_count episodes completed"
        echo
    fi
}

generate_footer() {
    local refresh_time
    refresh_time=$(date '+%Y-%m-%d %H:%M:%S')

    cat <<EOF
---

## 🔧 Quick Commands

\`\`\`bash
# Generate new dashboard
tetraboard generate

# Start live monitoring
tetraboard watch --period 10

# Train ULM system
ulm train --episodes 20 "authentication functions" src/

# Generate with agent
multicat --agent openai --ulm-rank "user management" src/
\`\`\`

## 📊 Data Sources

- ULM Training: \`$ULM_DIR/logs/\`
- RAG State: \`$TETRA_USER_DATA/\`
- Agent Profiles: \`$RAG_DIR/agents/\`

*Dashboard refreshed: $refresh_time*
EOF
}

get_reward_status() {
    local reward="$1"
    if (( $(echo "$reward > 0.8" | bc -l 2>/dev/null || echo 0) )); then
        echo "🟢 Excellent"
    elif (( $(echo "$reward > 0.6" | bc -l 2>/dev/null || echo 0) )); then
        echo "🟡 Good"
    elif (( $(echo "$reward > 0.4" | bc -l 2>/dev/null || echo 0) )); then
        echo "🟠 Fair"
    else
        echo "🔴 Needs Training"
    fi
}

get_success_trend() {
    local rate="$1"
    if (( $(echo "$rate > 85" | bc -l 2>/dev/null || echo 0) )); then
        echo "🚀 Excellent"
    elif (( $(echo "$rate > 70" | bc -l 2>/dev/null || echo 0) )); then
        echo "📈 Good"
    else
        echo "📉 Improving"
    fi
}

# --- Main Commands ---

cmd_generate() {
    local output="${1:-$DASHBOARD_OUTPUT}"

    echo "Generating tetraboard dashboard..." >&2

    {
        generate_header
        generate_ulm_section
        generate_rag_section
        generate_story_section
        generate_footer
    } > "$output"

    echo "Dashboard generated: $output" >&2
}

cmd_watch() {
    local period="${1:-30}"
    local output="${2:-$DASHBOARD_OUTPUT}"

    echo "Starting tetraboard watch mode (refresh every ${period}s)" >&2
    echo "Press Ctrl+C to stop"

    while true; do
        cmd_generate "$output"
        sleep "$period"
    done
}

cmd_summary() {
    echo "=== TetraBoard System Summary ==="

    declare -A info ulm_stats rag_stats
    while IFS='=' read -r key value; do
        info["$key"]="$value"
    done < <(collect_system_info)

    while IFS='=' read -r key value; do
        ulm_stats["$key"]="$value"
    done < <(collect_ulm_stats)

    while IFS='=' read -r key value; do
        rag_stats["$key"]="$value"
    done < <(collect_rag_stats)

    echo "ULM Episodes: ${ulm_stats[total_episodes]:-0}"
    echo "RAG Generations: ${rag_stats[total_generations]:-0}"
    echo "Success Rate: ${rag_stats[success_rate]:-0}%"
    echo "Popular Agent: ${rag_stats[popular_agent]:-base}"
    echo "Last Updated: ${info[timestamp]}"
}

# --- Parse Commands ---

[[ $# -eq 0 ]] && { cmd_generate; exit 0; }

case "$1" in
    "generate")
        shift
        output="${1:-$DASHBOARD_OUTPUT}"
        cmd_generate "$output"
        ;;
    "watch")
        shift
        period="${1:-30}"
        output="${2:-$DASHBOARD_OUTPUT}"
        cmd_watch "$period" "$output"
        ;;
    "summary")
        cmd_summary
        ;;
    "ulm-stats")
        collect_ulm_stats
        ;;
    "rag-history")
        collect_rag_stats
        ;;
    "-h"|"--help"|"help")
        usage
        ;;
    *)
        echo "Unknown command: $1" >&2
        usage
        ;;
esac