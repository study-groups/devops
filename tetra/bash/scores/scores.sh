#!/usr/bin/env bash
# scores.sh - High Score and Monogram CLI
#
# Arcade-style scoring system for tetra games.
#
# Usage:
#   scores top [game] [count]     Show leaderboard
#   scores stats [monogram]       Show stats for monogram
#   scores claim <monogram>       Claim a monogram
#   scores verify <monogram>      Verify claim

SCORES_SRC="${SCORES_SRC:-$TETRA_SRC/bash/scores}"
SCORES_DIR="${SCORES_DIR:-$TETRA_DIR/scores}"

# Ensure runtime directory exists
[[ -d "$SCORES_DIR" ]] || mkdir -p "$SCORES_DIR"

# =============================================================================
# Display Functions
# =============================================================================

scores_top() {
    local game="${1:-quadrapole}"
    local count="${2:-10}"
    local period="${3:-allTime}"

    local file="$SCORES_DIR/global/${game}.json"

    if [[ ! -f "$file" ]]; then
        echo "No scores for $game"
        return 1
    fi

    echo ""
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║          HIGH SCORES: ${game^^}         ║"
    echo "  ╠══════════════════════════════════════╣"

    # Parse and display top scores
    local rank=1
    while IFS= read -r line; do
        local monogram score date
        monogram=$(echo "$line" | jq -r '.monogram')
        score=$(echo "$line" | jq -r '.score')
        date=$(echo "$line" | jq -r '.date' | cut -d'T' -f1)

        printf "  ║  %2d. %-3s  %8d  %s  ║\n" "$rank" "$monogram" "$score" "$date"
        ((rank++))

        [[ $rank -gt $count ]] && break
    done < <(jq -c '.allTime.entries[]' "$file" 2>/dev/null)

    echo "  ╚══════════════════════════════════════╝"
    echo ""
}

scores_stats() {
    local monogram="${1:-}"

    if [[ -z "$monogram" ]]; then
        # Show global stats
        scores_global_stats
        return
    fi

    monogram="${monogram^^}"
    local file="$SCORES_DIR/monograms/${monogram}.json"

    if [[ ! -f "$file" ]]; then
        echo "No data for $monogram"
        return 1
    fi

    echo ""
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║           PLAYER: $monogram                 ║"
    echo "  ╠══════════════════════════════════════╣"

    local claimed games_played total_time high_score
    claimed=$(jq -r '.claimed' "$file")
    games_played=$(jq -r '.stats.gamesPlayed' "$file")
    total_time=$(jq -r '.stats.totalTime' "$file")
    high_score=$(jq -r '.stats.highScore' "$file")

    local time_str
    time_str=$(printf "%02d:%02d:%02d" $((total_time/3600000)) $(((total_time%3600000)/60000)) $(((total_time%60000)/1000)))

    echo "  ║  Status:      $([ "$claimed" = "true" ] && echo "CLAIMED" || echo "GUEST")           ║"
    echo "  ║  Games:       $games_played                      ║"
    echo "  ║  Play Time:   $time_str                ║"
    echo "  ║  High Score:  $high_score                      ║"
    echo "  ╠══════════════════════════════════════╣"
    echo "  ║  PER-GAME STATS                      ║"
    echo "  ╠══════════════════════════════════════╣"

    # Show per-game stats
    jq -r '.games | to_entries[] | "\(.key):\(.value.gamesPlayed):\(.value.highScore)"' "$file" 2>/dev/null | \
    while IFS=: read -r game played high; do
        printf "  ║  %-12s  %3d games  %6d pts  ║\n" "$game" "$played" "$high"
    done

    echo "  ╚══════════════════════════════════════╝"
    echo ""
}

scores_global_stats() {
    local state_file="$SCORES_DIR/monogram_state.json"

    echo ""
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║           GLOBAL STATS               ║"
    echo "  ╠══════════════════════════════════════╣"

    if [[ -f "$state_file" ]]; then
        local total unique claimed playtime
        total=$(jq -r '.globalStats.totalConnections // 0' "$state_file")
        unique=$(jq -r '.globalStats.uniqueMonograms // 0' "$state_file")
        claimed=$(jq -r '.globalStats.claimedMonograms // 0' "$state_file")
        playtime=$(jq -r '.globalStats.totalPlayTime // 0' "$state_file")

        local time_str
        time_str=$(printf "%02d:%02d:%02d" $((playtime/3600000)) $(((playtime%3600000)/60000)) $(((playtime%60000)/1000)))

        echo "  ║  Total Connections:  $total               ║"
        echo "  ║  Unique Players:     $unique               ║"
        echo "  ║  Claimed Monograms:  $claimed               ║"
        echo "  ║  Total Play Time:    $time_str         ║"
    else
        echo "  ║  No stats available yet              ║"
    fi

    echo "  ╚══════════════════════════════════════╝"
    echo ""
}

scores_claim() {
    local monogram="${1:-}"

    if [[ -z "$monogram" ]]; then
        echo "Usage: scores claim <MONOGRAM>"
        return 1
    fi

    monogram="${monogram^^}"

    # Check if valid format
    if [[ ! "$monogram" =~ ^[A-Z]{3}$ ]]; then
        echo "Invalid monogram format. Use 3 letters (e.g., ACE)"
        return 1
    fi

    local file="$SCORES_DIR/monograms/${monogram}.json"

    # Check if already claimed
    if [[ -f "$file" ]] && [[ "$(jq -r '.claimed' "$file")" == "true" ]]; then
        echo "Monogram $monogram is already claimed!"
        return 1
    fi

    echo ""
    echo "  Claiming monogram: $monogram"
    echo ""

    # Get passphrase
    read -s -p "  Enter passphrase: " passphrase
    echo ""
    read -s -p "  Confirm passphrase: " confirm
    echo ""

    if [[ "$passphrase" != "$confirm" ]]; then
        echo "  Passphrases do not match!"
        return 1
    fi

    if [[ ${#passphrase} -lt 4 ]]; then
        echo "  Passphrase too short (min 4 characters)"
        return 1
    fi

    # Create claim via Node.js
    node -e "
        const { MonogramManager } = require('$SCORES_SRC/monogram.js');
        const manager = new MonogramManager({ dataDir: '$SCORES_DIR' });
        const result = manager.claim('$monogram', '$passphrase');
        console.log(JSON.stringify(result));
    "

    echo ""
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║  Monogram $monogram CLAIMED!              ║"
    echo "  ║                                      ║"
    echo "  ║  Your data will persist across       ║"
    echo "  ║  sessions. Use 'scores verify' to    ║"
    echo "  ║  authenticate on new devices.        ║"
    echo "  ╚══════════════════════════════════════╝"
    echo ""
}

scores_verify() {
    local monogram="${1:-}"

    if [[ -z "$monogram" ]]; then
        echo "Usage: scores verify <MONOGRAM>"
        return 1
    fi

    monogram="${monogram^^}"
    local file="$SCORES_DIR/monograms/${monogram}.json"

    if [[ ! -f "$file" ]]; then
        echo "Monogram $monogram not found"
        return 1
    fi

    if [[ "$(jq -r '.claimed' "$file")" != "true" ]]; then
        echo "Monogram $monogram is not claimed"
        return 1
    fi

    read -s -p "  Enter passphrase: " passphrase
    echo ""

    # Verify via Node.js
    local result
    result=$(node -e "
        const { MonogramManager } = require('$SCORES_SRC/monogram.js');
        const manager = new MonogramManager({ dataDir: '$SCORES_DIR' });
        const result = manager.verify('$monogram', '$passphrase');
        console.log(result.verified ? 'OK' : 'FAIL');
    ")

    if [[ "$result" == "OK" ]]; then
        echo ""
        echo "  Welcome back, $monogram!"
        echo ""
        return 0
    else
        echo ""
        echo "  Invalid passphrase!"
        echo ""
        return 1
    fi
}

scores_list() {
    local filter="${1:-}"

    echo ""
    echo "  Known Monograms:"
    echo "  ────────────────"

    ls "$SCORES_DIR/monograms/"*.json 2>/dev/null | while read -r file; do
        local m claimed games
        m=$(basename "$file" .json)
        claimed=$(jq -r '.claimed' "$file")
        games=$(jq -r '.stats.gamesPlayed' "$file")

        local status="    "
        [[ "$claimed" == "true" ]] && status="[*]"

        printf "  %s %s  %d games\n" "$status" "$m" "$games"
    done

    echo ""
    echo "  [*] = claimed"
    echo ""
}

# =============================================================================
# Main Dispatcher
# =============================================================================

scores() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        top|leaderboard)
            scores_top "$@"
            ;;
        stats|stat)
            scores_stats "$@"
            ;;
        claim)
            scores_claim "$@"
            ;;
        verify)
            scores_verify "$@"
            ;;
        list|ls)
            scores_list "$@"
            ;;
        help|--help|-h)
            cat <<'EOF'
Scores - Arcade High Score System

Usage: scores <command> [args]

Commands:
  top [game] [count]      Show leaderboard (default: quadrapole, 10)
  stats [monogram]        Show stats (global if no monogram)
  claim <monogram>        Claim a monogram with passphrase
  verify <monogram>       Verify claimed monogram
  list                    List all known monograms

Examples:
  scores top                    # Top 10 quadrapole scores
  scores top trax 20            # Top 20 trax scores
  scores stats ACE              # Stats for player ACE
  scores claim MRC              # Claim monogram MRC
  scores verify MRC             # Verify ownership

Data stored in: $TETRA_DIR/scores/
EOF
            ;;
        *)
            echo "Unknown command: $cmd"
            echo "Run 'scores help' for usage"
            return 1
            ;;
    esac
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    scores "$@"
fi
