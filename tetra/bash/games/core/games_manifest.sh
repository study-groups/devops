#!/usr/bin/env bash

# Games Manifest Module
# Aggregates per-game game.toml files into games.json for S3
#
# Usage:
#   games manifest rebuild    # Scan game.toml files → games.json
#   games manifest list       # Show games in manifest
#   games manifest validate   # Check manifest integrity

# Require toml_parser
if [[ -f "$TETRA_SRC/bash/utils/toml_parser.sh" ]]; then
    source "$TETRA_SRC/bash/utils/toml_parser.sh"
else
    echo "Error: toml_parser.sh not found" >&2
    return 1
fi

# =============================================================================
# MANIFEST REBUILD
# =============================================================================

games_manifest_rebuild() {
    local games_dir="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}"
    local output="${games_dir}/games.json"

    if [[ ! -d "$games_dir" ]]; then
        echo "Error: Games directory not found: $games_dir" >&2
        return 1
    fi

    # Require jq
    if ! command -v jq &>/dev/null; then
        echo "Error: jq required but not installed" >&2
        return 1
    fi

    echo "Rebuilding manifest from: $games_dir"

    # Build config object
    local config_json
    config_json=$(jq -n \
        --arg ts "$(date -Iseconds)" \
        '{
            generated_at: $ts,
            storage: {
                s3_bucket: "pja-games",
                s3_endpoint: "https://sfo3.digitaloceanspaces.com"
            }
        }')

    # Build games object
    local games_json="{}"
    local count=0

    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue

        local slug=$(basename "$game_dir")
        local toml_file="${game_dir}game.toml"

        # Skip if no game.toml
        [[ ! -f "$toml_file" ]] && continue

        echo "  Processing: $slug"

        # Clear previous parse and parse fresh
        for var in $(compgen -v | grep "^GAME_"); do unset "$var"; done
        toml_parse "$toml_file" "GAME"

        # Extract values with defaults
        local name="${GAME_game[name]:-$slug}"
        local summary="${GAME_game[summary]:-}"
        local version="${GAME_game[version]:-1.0.0}"
        local show="${GAME_game[show]:-true}"
        local tags="${GAME_game[tags]:-}"

        local path_latest="${GAME_paths[latest]:-index.html}"
        local path_demo="${GAME_paths[demo]:-}"
        local path_dev="${GAME_paths[dev]:-}"

        local requires_auth="${GAME_access[requires_auth]:-false}"
        local min_role="${GAME_access[min_role]:-guest}"
        local min_subscription="${GAME_access[min_subscription]:-free}"

        local thumbnail="${GAME_display[thumbnail]:-${slug}/thumbnail.jpg}"

        # Convert tags string to JSON array
        local tags_json="[]"
        if [[ -n "$tags" ]]; then
            # tags comes as: "puzzle", "casual" (without outer brackets)
            tags_json="[${tags}]"
        fi

        # Build optional path arguments for jq
        local demo_arg="" dev_arg=""
        [[ -n "$path_demo" ]] && demo_arg="${slug}/${path_demo}"
        [[ -n "$path_dev" ]] && dev_arg="${slug}/${path_dev}"

        # Build game JSON object
        local game_json
        game_json=$(jq -n \
            --arg slug "$slug" \
            --arg name "$name" \
            --arg summary "$summary" \
            --arg src "/api/game-files/${slug}/${path_latest}" \
            --arg url_path "${slug}/${path_latest}" \
            --arg url_path_demo "$demo_arg" \
            --arg url_path_dev "$dev_arg" \
            --arg thumbnail "$thumbnail" \
            --argjson requires_auth "$requires_auth" \
            --arg min_role "$min_role" \
            --arg min_subscription "$min_subscription" \
            --argjson tags "$tags_json" \
            --argjson show "$show" \
            --arg version "$version" \
            '{
                slug: $slug,
                name: $name,
                summary: $summary,
                src: $src,
                url_path: $url_path,
                thumbnail: $thumbnail,
                access_control: {
                    requires_auth: $requires_auth,
                    min_role: $min_role,
                    min_subscription: $min_subscription
                },
                tags: $tags,
                show: $show,
                version: $version
            }
            | if $url_path_demo != "" then . + {url_path_demo: $url_path_demo} else . end
            | if $url_path_dev != "" then . + {url_path_dev: $url_path_dev} else . end
            ')

        # Add to games object
        games_json=$(echo "$games_json" | jq --arg slug "$slug" --argjson game "$game_json" '. + {($slug): $game}')

        ((count++))
    done

    # Combine into final JSON
    jq -n \
        --argjson config "$config_json" \
        --argjson games "$games_json" \
        '{
            _config: $config,
            games: $games
        }' > "$output"

    echo ""
    echo "Generated: $output"
    echo "Games: $count"
}

# =============================================================================
# MANIFEST LIST
# =============================================================================

games_manifest_list() {
    local manifest=""

    # Accept path as argument or use default
    if [[ -n "$1" && -f "$1" ]]; then
        manifest="$1"
    else
        local games_dir="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}"
        manifest="${games_dir}/games.json"
    fi

    if [[ ! -f "$manifest" ]]; then
        echo "Manifest not found: $manifest" >&2
        echo "Run: games manifest rebuild" >&2
        return 1
    fi

    echo "Games in manifest:"
    echo ""
    printf "  %-20s %-8s %-5s %s\n" "SLUG" "VERSION" "SHOW" "NAME"
    printf "  %-20s %-8s %-5s %s\n" "----" "-------" "----" "----"

    jq -r '.games | to_entries[] | "\(.key)\t\(.value.version)\t\(.value.show)\t\(.value.name)"' "$manifest" | \
        while IFS=$'\t' read -r slug version show name; do
            printf "  %-20s %-8s %-5s %s\n" "$slug" "$version" "$show" "$name"
        done
}

# =============================================================================
# MANIFEST VALIDATE
# =============================================================================

games_manifest_validate() {
    local games_dir="${PJA_GAMES_DIR:-${TETRA_DIR}/orgs/pixeljam-arcade/games}"
    local manifest="${games_dir}/games.json"
    local errors=0

    echo "Validating manifest..."
    echo ""

    # Check manifest exists
    if [[ ! -f "$manifest" ]]; then
        echo "[FAIL] Manifest not found: $manifest"
        return 1
    fi
    echo "[OK] Manifest exists: $manifest"

    # Check JSON syntax
    if jq empty "$manifest" 2>/dev/null; then
        echo "[OK] Valid JSON syntax"
    else
        echo "[FAIL] Invalid JSON syntax"
        ((errors++))
    fi

    # Check required structure
    if jq -e '._config.storage.s3_bucket' "$manifest" >/dev/null 2>&1; then
        echo "[OK] Has _config.storage.s3_bucket"
    else
        echo "[FAIL] Missing _config.storage.s3_bucket"
        ((errors++))
    fi

    if jq -e '.games' "$manifest" >/dev/null 2>&1; then
        local game_count=$(jq '.games | length' "$manifest")
        echo "[OK] Has games section ($game_count games)"
    else
        echo "[FAIL] Missing games section"
        ((errors++))
    fi

    # Check each game has required fields
    echo ""
    echo "Checking games..."
    jq -r '.games | keys[]' "$manifest" 2>/dev/null | while read -r slug; do
        local missing=""
        for field in name url_path access_control; do
            if ! jq -e ".games[\"$slug\"].$field" "$manifest" >/dev/null 2>&1; then
                missing+=" $field"
            fi
        done
        if [[ -n "$missing" ]]; then
            echo "[WARN] $slug missing:$missing"
        else
            echo "[OK] $slug"
        fi
    done

    echo ""
    if ((errors == 0)); then
        echo "Validation passed"
    else
        echo "Validation failed with $errors errors"
        return 1
    fi
}

# =============================================================================
# MANIFEST COMMAND DISPATCHER
# =============================================================================

games_manifest() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        rebuild|build)
            games_manifest_rebuild "$@"
            ;;
        list|ls)
            games_manifest_list "$@"
            ;;
        validate|check)
            games_manifest_validate "$@"
            ;;
        help|-h|--help)
            cat << 'EOF'
GAMES MANIFEST - Manage games.json manifest

USAGE
  games manifest rebuild     Scan game.toml files → generate games.json
  games manifest list        Show games in manifest
  games manifest validate    Check manifest integrity

FLOW
  1. Edit game.toml in each game directory
  2. Run: games manifest rebuild
  3. Run: games manifest push (upload to S3)
EOF
            ;;
        *)
            echo "Unknown manifest command: $cmd" >&2
            echo "Run 'games manifest help' for usage" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_manifest
export -f games_manifest_rebuild
export -f games_manifest_list
export -f games_manifest_validate
