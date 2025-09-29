#!/usr/bin/env bash
# rl_trainer.sh - Reinforcement Learning trainer for ULM policies
set -euo pipefail

ULM_DIR="${BASH_SOURCE[0]%/*}/.."
ULM_TRAINING_DIR="$ULM_DIR/training"
ULM_LOGS_DIR="$ULM_DIR/logs"

source "$ULM_DIR/models/attention.sh"

# --- Training State ---
declare -A POLICY_PARAMS=(
    ["func_weight"]=0.4
    ["struct_weight"]=0.3
    ["temp_weight"]=0.2
    ["dep_weight"]=0.1
)

BASELINE_REWARD=0.5
LEARNING_RATE=0.1
EXPLORATION_RATE=0.1
EPISODE_COUNT=0

# --- Reward Calculation ---

calculate_reward() {
    local ranking_results="$1"
    local ground_truth="$2"
    local user_feedback="${3:-}"

    local precision=0 recall=0 user_score=3.0

    # If ground truth provided, calculate precision/recall
    if [[ -n "$ground_truth" ]]; then
        local relevant_files predicted_files common_files
        relevant_files=$(wc -l < "$ground_truth")
        predicted_files=$(echo "$ranking_results" | wc -l)

        # Count intersection
        common_files=$(comm -12 <(echo "$ranking_results" | sort) <(sort "$ground_truth") | wc -l)

        precision=$(echo "scale=4; $common_files / $predicted_files" | bc)
        recall=$(echo "scale=4; $common_files / $relevant_files" | bc)
    fi

    # Parse user feedback if provided (1-5 scale)
    if [[ -n "$user_feedback" && "$user_feedback" =~ ^[1-5]$ ]]; then
        user_score="$user_feedback.0"
    fi

    # Combined reward (precision + recall + user feedback)
    local reward
    if [[ $precision > 0 || $recall > 0 ]]; then
        reward=$(echo "scale=4; ($precision + $recall) / 2 * 0.7 + $user_score / 5 * 0.3" | bc)
    else
        # User feedback only
        reward=$(echo "scale=4; $user_score / 5" | bc)
    fi

    echo "$reward"
}

# --- Policy Updates ---

update_policy_gradient() {
    local reward="$1"
    local policy_file="$2"

    # Policy gradient: if reward > baseline, reinforce; else explore
    local reward_delta
    reward_delta=$(echo "scale=4; $reward - $BASELINE_REWARD" | bc)

    for param in "${!POLICY_PARAMS[@]}"; do
        local current_value="${POLICY_PARAMS[$param]}"
        local gradient noise new_value

        if (( $(echo "$reward_delta > 0" | bc -l) )); then
            # Positive reward: small step in same direction
            gradient=$(echo "scale=4; $LEARNING_RATE * $reward_delta" | bc)
        else
            # Negative reward: exploration noise
            gradient=$(echo "scale=4; $LEARNING_RATE * $reward_delta * (($RANDOM % 100) / 100 - 0.5)" | bc)
        fi

        new_value=$(echo "scale=4; $current_value + $gradient" | bc)

        # Clamp to valid ranges (weights should sum to ~1.0)
        if (( $(echo "$new_value < 0.05" | bc -l) )); then
            new_value="0.05"
        elif (( $(echo "$new_value > 0.8" | bc -l) )); then
            new_value="0.8"
        fi

        POLICY_PARAMS["$param"]="$new_value"
    done

    # Normalize weights to sum to 1.0
    normalize_policy_weights

    # Update baseline reward (moving average)
    BASELINE_REWARD=$(echo "scale=4; $BASELINE_REWARD * 0.9 + $reward * 0.1" | bc)

    # Save updated policy
    save_policy "$policy_file"

    echo "Policy updated: reward=$reward, baseline=$BASELINE_REWARD"
}

normalize_policy_weights() {
    local total=0

    # Calculate sum
    for param in func_weight struct_weight temp_weight dep_weight; do
        total=$(echo "scale=4; $total + ${POLICY_PARAMS[$param]}" | bc)
    done

    # Normalize each weight
    for param in func_weight struct_weight temp_weight dep_weight; do
        POLICY_PARAMS["$param"]=$(echo "scale=4; ${POLICY_PARAMS[$param]} / $total" | bc)
    done
}

# --- Multi-Armed Bandit ---

declare -A ALGORITHM_REWARDS=()
declare -A ALGORITHM_COUNTS=()
declare -a ALGORITHMS=("multi_head" "tfidf" "complexity" "semantic")

select_algorithm_bandit() {
    local exploration_rate="${1:-$EXPLORATION_RATE}"

    # Initialize if needed
    for algo in "${ALGORITHMS[@]}"; do
        if [[ -z "${ALGORITHM_REWARDS[$algo]:-}" ]]; then
            ALGORITHM_REWARDS["$algo"]=0.5
            ALGORITHM_COUNTS["$algo"]=1
        fi
    done

    # Epsilon-greedy selection
    if (( $(echo "scale=4; ($RANDOM % 10000) / 10000 < $exploration_rate" | bc -l) )); then
        # Explore: random algorithm
        echo "${ALGORITHMS[$((RANDOM % ${#ALGORITHMS[@]}))]}"
    else
        # Exploit: best performing algorithm
        local best_algo="" best_reward=0

        for algo in "${ALGORITHMS[@]}"; do
            local avg_reward
            avg_reward=$(echo "scale=4; ${ALGORITHM_REWARDS[$algo]} / ${ALGORITHM_COUNTS[$algo]}" | bc)

            if (( $(echo "$avg_reward > $best_reward" | bc -l) )); then
                best_reward="$avg_reward"
                best_algo="$algo"
            fi
        done

        echo "$best_algo"
    fi
}

update_algorithm_rewards() {
    local algorithm="$1"
    local reward="$2"

    # Update running average
    local count="${ALGORITHM_COUNTS[$algorithm]}"
    local total_reward="${ALGORITHM_REWARDS[$algorithm]}"

    ALGORITHM_COUNTS["$algorithm"]=$((count + 1))
    ALGORITHM_REWARDS["$algorithm"]=$(echo "scale=4; $total_reward + $reward" | bc)
}

# --- Training Episode ---

run_training_episode() {
    local query="$1"
    local dataset_path="$2"
    local ground_truth="${3:-}"
    local method="${4:-policy}"

    ((EPISODE_COUNT++))

    local algorithm ranking_results reward
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local episode_id="${EPISODE_COUNT}_$(date +%s)"

    case "$method" in
        "bandit")
            algorithm=$(select_algorithm_bandit)
            echo "Episode $EPISODE_COUNT: Using algorithm $algorithm (bandit selection)"
            ;;
        "policy")
            algorithm="multi_head"
            echo "Episode $EPISODE_COUNT: Using multi-head with current policy"
            ;;
        *)
            algorithm="$method"
            echo "Episode $EPISODE_COUNT: Using fixed algorithm $algorithm"
            ;;
    esac

    # Run ranking with current policy
    if [[ "$algorithm" == "multi_head" ]]; then
        local weights="${POLICY_PARAMS[func_weight]},${POLICY_PARAMS[struct_weight]},${POLICY_PARAMS[temp_weight]},${POLICY_PARAMS[dep_weight]}"
        ranking_results=$(ulm_rank_with_policy "$query" "$dataset_path" "$weights")
    else
        ranking_results=$("$ULM_DIR/ulm.sh" rank --algorithm "$algorithm" --top 10 "$query" "$dataset_path")
    fi

    # Calculate reward
    reward=$(calculate_reward "$ranking_results" "$ground_truth")

    # Update based on method
    case "$method" in
        "bandit")
            update_algorithm_rewards "$algorithm" "$reward"
            echo "Algorithm $algorithm reward: $reward"
            ;;
        "policy")
            update_policy_gradient "$reward" "$ULM_TRAINING_DIR/current_policy.conf"
            echo "Policy gradient update: reward=$reward"
            ;;
    esac

    # Log episode
    {
        echo "$timestamp|episode|$episode_id|$algorithm|$reward|$query"
    } >> "$ULM_LOGS_DIR/training.log"

    echo "Episode $EPISODE_COUNT complete: algorithm=$algorithm, reward=$reward"
    echo "$ranking_results"
}

ulm_rank_with_policy() {
    local query="$1" path="$2" weights="$3"

    # Use the multi_head_attention function with custom weights
    find "$path" -type f \( -name "*.js" -o -name "*.py" -o -name "*.sh" -o -name "*.ts" \) | \
    head -50 | while read -r file; do
        local score
        score=$(multi_head_attention "$query" "$file" "$weights")
        echo "$score:$file"
    done | sort -rn | head -10 | cut -d: -f2
}

# --- Policy Management ---

save_policy() {
    local file="$1"
    {
        echo "# ULM Policy - Generated $(date)"
        echo "# Episode: $EPISODE_COUNT, Baseline: $BASELINE_REWARD"
        for param in "${!POLICY_PARAMS[@]}"; do
            echo "POLICY_PARAMS[$param]=${POLICY_PARAMS[$param]}"
        done
        echo "BASELINE_REWARD=$BASELINE_REWARD"
        echo "EPISODE_COUNT=$EPISODE_COUNT"
    } > "$file"
}

load_policy() {
    local file="$1"
    if [[ -f "$file" ]]; then
        # Clear current policy
        unset POLICY_PARAMS
        declare -gA POLICY_PARAMS

        # Load new policy
        source "$file"
        echo "Policy loaded from $file (episode $EPISODE_COUNT)"
    else
        echo "Warning: Policy file not found: $file" >&2
        return 1
    fi
}

# --- Training Loop ---

train_episodes() {
    local episodes="$1"
    local query="$2"
    local dataset="$3"
    local method="${4:-policy}"
    local ground_truth="${5:-}"

    echo "Starting training: $episodes episodes using $method method"
    echo "Query: $query"
    echo "Dataset: $dataset"

    # Initialize training log
    mkdir -p "$ULM_LOGS_DIR"
    if [[ ! -f "$ULM_LOGS_DIR/training.log" ]]; then
        echo "timestamp|type|episode_id|algorithm|reward|query" > "$ULM_LOGS_DIR/training.log"
    fi

    # Training loop
    for ((i=1; i<=episodes; i++)); do
        echo
        echo "=== Episode $i/$episodes ==="

        run_training_episode "$query" "$dataset" "$ground_truth" "$method"

        # Save checkpoints every 10 episodes
        if (( i % 10 == 0 )); then
            save_policy "$ULM_TRAINING_DIR/checkpoint_${i}.conf"
            echo "Checkpoint saved: episode $i"
        fi

        # Brief pause between episodes
        sleep 0.1
    done

    echo
    echo "Training complete! Final policy:"
    for param in "${!POLICY_PARAMS[@]}"; do
        printf "  %-15s: %.4f\n" "$param" "${POLICY_PARAMS[$param]}"
    done
    echo "  baseline_reward: $BASELINE_REWARD"

    # Save final policy
    save_policy "$ULM_TRAINING_DIR/final_policy.conf"
}

# --- CLI Interface ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        "train")
            shift
            episodes="${1:-10}"
            query="${2:-test query}"
            dataset="${3:-.}"
            method="${4:-policy}"
            ground_truth="${5:-}"
            train_episodes "$episodes" "$query" "$dataset" "$method" "$ground_truth"
            ;;
        "episode")
            shift
            query="${1:-test query}"
            dataset="${2:-.}"
            ground_truth="${3:-}"
            method="${4:-policy}"
            run_training_episode "$query" "$dataset" "$ground_truth" "$method"
            ;;
        "load")
            load_policy "${2:-$ULM_TRAINING_DIR/current_policy.conf}"
            ;;
        "save")
            save_policy "${2:-$ULM_TRAINING_DIR/current_policy.conf}"
            ;;
        *)
            echo "Usage: rl_trainer.sh {train|episode|load|save} [args...]"
            echo
            echo "Commands:"
            echo "  train <episodes> <query> <dataset> [method] [ground_truth]"
            echo "  episode <query> <dataset> [ground_truth] [method]"
            echo "  load [policy_file]"
            echo "  save [policy_file]"
            exit 1
            ;;
    esac
fi